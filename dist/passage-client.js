var Passage = (function () {
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function runEvent(method, params) {
    if (method === undefined || this._events[method] === undefined) return;
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        for (var _iterator = this._events[method][Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var func = _step.value;

            func(params);
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
            }
        } finally {
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }
}

function onOpen() {
    this._tries = 0;
    runEvent.call(this, 'rpc.open');
}

function onClose() {
    if (this.options.reconnect && this._tries <= this.options.reconnectTries) {
        this._tries++;
        setTimeout(this.connect, this.options.reconnectTimeout);
    }
    runEvent.call(this, 'rpc.close');
}

function onError(error) {
    runEvent.call(this, 'rpc.error', error);
}

function testRpcMessage(message) {
    if (message.jsonrpc !== '2.0') throw new Error();
    if (message.method !== undefined) return message;
    if (message.id === undefined) throw new Error();
    if (message.error !== undefined) return message;
    if (message.result !== undefined) return message;
    throw new Error();
}

function parseData(data) {
    var result = JSON.parse(data);
    if (Array.isArray(result)) return result.map(testRpcMessage);
    return [testRpcMessage(result)];
}

function runCallback(id, error, result) {
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

function onMessage(event) {
    var messages = void 0;
    try {
        messages = parseData(event.data);
    } catch (e) {
        console.log('Warning: Non JSON-RPC message received.');
        console.log(event.data);
        return;
    }

    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
        for (var _iterator2 = messages[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            var message = _step2.value;

            runEvent.call(this, 'rpc.message', message);
            runEvent.call(this, message.method, message.params);
            runCallback.call(this, message.id, message.error, message.result);
        }
    } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion2 && _iterator2.return) {
                _iterator2.return();
            }
        } finally {
            if (_didIteratorError2) {
                throw _iteratorError2;
            }
        }
    }
}

function runTimeout(id) {
    if (this._callbacks[id] === undefined) return;

    var error = new Error('Timeout');
    error.code = 408;

    this._callbacks[id](error);
    delete this._callbacks[id];
}

var numOrDef = function numOrDef(num, def) {
    return typeof num === 'number' ? num : def;
};

var Passage = function () {
    function Passage(uri) {
        var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

        _classCallCheck(this, Passage);

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

    _createClass(Passage, [{
        key: 'close',
        value: function close() {
            if (this.connection !== undefined) this.connection.close();
        }
    }, {
        key: 'connect',
        value: function connect() {
            this.close();
            this.connection = new WebSocket(this.uri);
            this.connection.addEventListener('open', onOpen.bind(this));
            this.connection.addEventListener('close', onClose.bind(this));
            this.connection.addEventListener('error', onError.bind(this));
            this.connection.addEventListener('message', onMessage.bind(this));
        }
    }, {
        key: 'send',
        value: function send(method, params, callback, timeout) {
            var _this = this;

            if (this.connection === undefined) {
                if (typeof callback === 'function') callback(new Error('No connection'));
                return;
            }

            var id = typeof callback === 'function' ? this._nextId++ : undefined;

            var message = void 0;
            try {
                message = JSON.stringify({ id: id, method: method, params: params, jsonrpc: '2.0' });
            } catch (e) {
                if (typeof callback === 'function') callback(e);
                return;
            }

            if (typeof callback === 'function') {
                this._callbacks[id] = callback;
                var ms = numOrDef(timeout, this.options.requestTimeout);
                setTimeout(function () {
                    runTimeout.call(_this, id);
                }, ms);
            }

            this.connection.send(message);
        }
    }, {
        key: 'addEventListener',
        value: function addEventListener(method, callback) {
            this._events[method] = this._events[method] || [];
            this._events[method].push(callback);
        }
    }, {
        key: 'removeEventListener',
        value: function removeEventListener(method, callback) {
            if (this._events[method] === undefined) return;
            var index = this._events[method].indexOf(callback);
            if (index < 0) return;
            this._events[method].splice(index, 1);
            if (this._events[method].length < 1) delete this._events[method];
        }
    }]);

    return Passage;
}();

return Passage;

}());
