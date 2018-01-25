# Passage Client

#### Client side JSON-RPC 2.0 websockets library

This is websocket subprotocol implementation for remote procedure calls and supports server responses. Useful when used with a server that supports JSON-RPC.

http://www.jsonrpc.org/specification

### Installation from NPM

Install the package from npm.

```
npm i passage-client --save
```

Import it into your scripts.

```javascript
import Passage from 'passage-client';
```

### Installation from iife

Download and include the library on your page.

```html
<script src="/javascripts/passage-client.min.js"></script>
```

### Usage

Create a new instance of `Passage` providing a uri and set of options.

```javascript
const passage = new Passage('wss://example.com', options);
```
