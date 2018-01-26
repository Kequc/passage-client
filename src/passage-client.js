module.exports = function (WebSocket) {

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
            var _this = this;
            setTimeout(function () { _this.connect(); }, this.options.reconnectTimeout);
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
        if (message.error !== undefined && message.result !== undefined) return TYPE.INVALID;
        if (message.error !== undefined || message.result !== undefined) return TYPE.RESPONSE;
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
        if (this._callbacks[id] === undefined) return;
    
        var error = new Error('Timeout');
        error.code = 408;
    
        this._callbacks[id](error);
        delete this._callbacks[id];
    }

    function numOrDef (num, def) {
        return (typeof num === 'number' ? num : def);
    }

    // connection.readyState;
    // {
    //     CONNECTING: 0,
    //     OPEN: 1,
    //     CLOSING: 2,
    //     CLOSED: 3
    // };

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
            var _this = this;
            setTimeout(function () { runTimeout.call(_this, id); }, ms);
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

    return Passage;
    
};
