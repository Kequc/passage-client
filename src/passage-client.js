function runEvent (method, params) {
    if (method === undefined || this._events[method] === undefined) return;
    for (var i = 0; i < this._events[method].length; i++) {
        this._events[method][i](params);
    }
}

function onOpen () {
    this._tries = 0;
    runEvent.call(this, 'rpc.open');
}

function onClose () {
    if (this.options.reconnect && !this.connection.killed && this._tries <= this.options.reconnectTries) {
        this._tries++;
        setTimeout(this.connect.bind(this), this.options.reconnectTimeout);
    }
    runEvent.call(this, 'rpc.close');
}

function onError (event) {
    runEvent.call(this, 'rpc.error', event);
}

function runCallback (id, error, result) {
    if (id !== undefined && this._callbacks[id] !== undefined) {
        if (error) {
            var err = new Error(error.message);
            err.code = error.code;
            err.data = error.data;
            this._callbacks[id](err);
        } else {
            this._callbacks[id](undefined, result);
        }
    }
    delete this._callbacks[id];
}

var TYPE = {
    INVALID: 'invalid',
    RESPONSE: 'response',
    NOTIFICATION: 'notification'
};

function messageType (message) {
    if (typeof message !== 'object') return TYPE.INVALID;
    if (message.jsonrpc !== '2.0') return TYPE.INVALID;
    if (message.method !== undefined) return TYPE.NOTIFICATION;
    if (message.id === undefined) return TYPE.INVALID;
    if (message.error !== undefined) return TYPE.RESPONSE;
    if (message.result !== undefined) return TYPE.RESPONSE;
    return TYPE.INVALID;
}

function onMessage (event) {
    runEvent.call(this, 'rpc.message', event.data);
    
    var messages;
    try {
        messages = JSON.parse(event.data);
        if (!Array.isArray(messages)) messages = [messages];
    } catch (e) {
        return;
    }
    
    for (var i = 0; i < messages.length; i++) {
        var message = messages[i];
        var type = messageType(message);
        switch (type) {
        case TYPE.NOTIFICATION:
            runEvent.call(this, message.method, message.params);
            break;
        case TYPE.RESPONSE:
            runCallback.call(this, message.id, message.error, message.result);
            break;
        }
    }
}

function runTimeout (id) {
    return function () {
        if (this._callbacks[id] === undefined) return;

        var error = new Error('Timeout');
        error.code = 408;

        this._callbacks[id](error);
        delete this._callbacks[id];
    };
}

function numOrDef (num, def) {
    return (typeof num === 'number' ? num : def);
}

function buildMessages (arr) {
    var result = [];

    for (var i = 0; i < arr.length; i++) {
        var obj = arr[i];

        if (typeof obj !== 'object' || typeof obj.method !== 'string') {
            if (typeof obj.callback === 'function') obj.callback(new Error('Invalid payload'));
            continue;
        }

        var data = {
            id: (typeof obj.callback === 'function' ? this._nextId++ : undefined),
            method: obj.method,
            params: obj.params,
            jsonrpc: '2.0'
        };

        result.push({ id: data.id, payload: JSON.stringify(data), callback: obj.callback });
    }

    return result;
}

module.exports = function (WebSocket) {
    function Passage (uri, options) {
        options = options || {};
        this.uri = uri;
        this.options = {
            requestTimeout: numOrDef(options.requestTimeout, 6000),
            reconnect: !!options.reconnect,
            reconnectTimeout: numOrDef(options.reconnectTimeout, 2000),
            reconnectTries: numOrDef(options.reconnectTries, 60)
        };
        this._nextId = 1;
        this._tries = 0;
        this._callbacks = {};
        this._events = {};
        this.connect();
    }

    Passage.prototype.close = function () {
        if (this.connection === undefined) return;
        this.connection.killed = true;
        this.connection.close();
    };

    Passage.prototype.connect = function () {
        this.close();
        this.connection = new WebSocket(this.uri);
        this.connection.addEventListener('open', onOpen.bind(this));
        this.connection.addEventListener('close', onClose.bind(this));
        this.connection.addEventListener('error', onError.bind(this));
        this.connection.addEventListener('message', onMessage.bind(this));
    };

    Passage.prototype.sendAll = function (arr, timeout) {
        if (this.connection === undefined) {
            for (var i = 0; i < arr.length; i++) {
                if (typeof arr[i].callback === 'function') arr[i].callback(new Error('No connection'));
            }
            return;
        }

        var messages = buildMessages.call(this, arr);

        for (var j = 0; j < messages.length; j++) {
            var id = messages[j].id;
            if (id !== undefined) {
                this._callbacks[id] = messages[j].callback;
                var ms = numOrDef(timeout, this.options.requestTimeout);
                setTimeout(runTimeout(id).bind(this), ms);
            }
        }

        if (messages.length > 1) {
            this.connection.send('[' + messages.map(function (message) { return message.payload; }).join(',') + ']');
        } else if (messages.length === 1) {
            this.connection.send(messages[0].payload);
        }
    };

    Passage.prototype.send = function (method, params, callback, timeout) {
        if (typeof params === 'function') {
            timeout = callback;
            callback = params;
            params = undefined;
        }
        const data = {
            method: method,
            params: params,
            callback: callback
        };
        this.sendAll([data], timeout);
    };

    Passage.prototype.addEventListener = function (method, callback) {
        this._events[method] = this._events[method] || [];
        this._events[method].push(callback);
    };

    Passage.prototype.removeEventListeners = function (method) {
        delete this._events[method];
    };

    Passage.prototype.removeEventListener = function (method, callback) {
        if (this._events[method] === undefined) return;

        var index = this._events[method].indexOf(callback);
        if (index < 0) return;

        if (this._events[method].length <= 1) {
            this.removeEventListeners(method);
        } else {
            this._events[method].splice(index, 1);
        }
    };

    return Passage;
};
