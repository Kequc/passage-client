# Passage Client

#### Client side JSON-RPC 2.0 websockets library

This is websocket subprotocol implementation for remote procedure calls and supports server responses. Useful when used with a server that supports JSON-RPC.

http://www.jsonrpc.org/specification

## Installation from NPM

Install the package from npm.

```
npm i passage-client --save
```

Import it into your client side script.

```javascript
const Passage = require('passage-client');
```

## Installation from IIFE

Download and include the library on your page.

```html
<script src="/javascripts/passage-client.min.js"></script>
```

## Usage

Create a new instance of `Passage` providing a uri and set of options.

```javascript
const options = {
    requestTimeout: 6000,
    reconnect: false,
    reconnectTimeout: 2000,
    reconnectTries: 60
};

const passage = new Passage('wss://example.com', options);

passage.addEventListener('rpc.open', () => {
    console.log('connected!');
});

passage.addEventListener('myapp.newuser', (params) => {
    console.log(params);
});
```

## Options

#### requestTimeout <default: 6000>

The amount of time the server can take responding to requests.

#### reconnect <default: false>

Whether the client should attempt to reconnect when disconnected.

#### reconnectTimeout <default: 2000>

The amount of time to wait before attempting to reconnect.

#### reconnectTries <default: 60>

The maximum number of tries when attempting to reconnect.

## Instance

#### addEventListener (method: string, callback: (params) => void) => void

When the server sends a notification to your application, you may choose to set an event for that data using its' method name. There are a few included events the library provides.

| method | description |
| - | - |
| `rpc.open` | Connection established. |
| `rpc.close` | Connection closed. |
| `rpc.error` | Error has occurred. |
| `rpc.message` | Message was received. |

#### removeEventListener (method: string, callback: Function) => void

The notification you would like to stop listening to.

#### close () => void

Closes the connection.

#### connect () => void

This will close the connection, then reconnect.

#### send (method: string, params: any, [callback: (error: Error, result: any) => void, timeout: number]) => void

Send a request to the server. If a callback is provided, then the server will respond once it has finished processing the request. It may recieve a error or a result. If a timeout is provided it will override the default request timeout.
