function runEvent (method, params) {
    if (method === undefined || this._events[method] === undefined) return;
    for (var i = 0; i < this._events.length; i++) {
        this._events[i](params);
    }
}

function onOpen () {
    this._tries = 0;
    runEvent.call(this, 'rpc.open');
}

function onClose () {
    if (this.options.reconnect && this._tries <= this.options.reconnectTries) {
        this._tries++;
        setTimeout(this.connect, this.options.reconnectTimeout);
    }
    runEvent.call(this, 'rpc.close');
}

function onError (error) {
    runEvent.call(this, 'rpc.error', error);
}

function testRpcMessage (message) {
    if (message.jsonrpc !== '2.0') throw new Error();
    if (message.method !== undefined) return message;
    if (message.id === undefined) throw new Error();
    if (message.error !== undefined) return message;
    if (message.result !== undefined) return message;
    throw new Error();
}

function parseData (data) {
    var result = JSON.parse(data);
    if (Array.isArray(result)) return result.map(testRpcMessage);
    return [testRpcMessage(result)];
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

function onMessage (event) {
    var messages;
    try {
        messages = parseData(event.data);
    } catch (e) {
        console.log('Warning: Non JSON-RPC message received.');
        console.log(event.data);
        return;
    }

    for (var i = 0; i < messages.length; i++) {
        var message = messages[i];
        runEvent.call(this, 'rpc.message', message);
        runEvent.call(this, message.method, message.params);
        runCallback.call(this, message.id, message.error, message.result);
    }
}

function runTimeout (id) {
    if (this._callbacks[id] === undefined) return;

    var error = new Error('Timeout');
    error.code = 408;

    this._callbacks[id](error);
    delete this._callbacks[id];
}

function numOrDef (num, def) {
    return (typeof num === 'number' ? num : def);
}

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
    if (this.connection !== undefined) this.connection.close();
};

Passage.prototype.connect = function () {
    this.close();
    this.connection = new WebSocket(this.uri);
    this.connection.addEventListener('open', onOpen.bind(this));
    this.connection.addEventListener('close', onClose.bind(this));
    this.connection.addEventListener('error', onError.bind(this));
    this.connection.addEventListener('message', onMessage.bind(this));
};

Passage.prototype.send = function (method, params, callback, timeout) {
    if (this.connection === undefined) {
        if (typeof callback === 'function') callback(new Error('No connection'));
        return;
    }

    var id = (typeof callback === 'function' ? this._nextId++ : undefined);

    var message;
    try {
        message = JSON.stringify({ id: id, method: method, params: params, jsonrpc: '2.0' });
    } catch (e) {
        if (typeof callback === 'function') callback(e);
        return;
    }

    if (typeof callback === 'function') {
        this._callbacks[id] = callback;
        var ms = numOrDef(timeout, this.options.requestTimeout);
        setTimeout(function () { runTimeout.call(this, id); }, ms);
    }

    this.connection.send(message);
};

Passage.prototype.addEventListener = function (method, callback) {
    this._events[method] = this._events[method] || [];
    this._events[method].push(callback);
};

Passage.prototype.removeEventListener = function (method, callback) {
    if (this._events[method] === undefined) return;
    var index = this._events[method].indexOf(callback);
    if (index < 0) return;
    this._events[method].splice(index, 1);
    if (this._events[method].length < 1) delete this._events[method];
};

export default Passage;
