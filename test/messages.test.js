const expect = require('expect.js');
const { Server, WebSocket } = require('mock-socket');
const passageClient = require('../src/passage-client');

const Passage = passageClient(WebSocket);

const URI = 'ws://fake-server.io';
const method = 'myapp.notify';

describe('messages', () => {
    let server;
    let passage;

    beforeEach(() => {
        server = new Server(URI);
        passage = new Passage(URI);
    });
    afterEach(() => {
        server.close();
    });

    describe('events', () => {
        it('should receive a notification', done => {
            const params = { some: 'data' };
            passage.addEventListener(method, received => {
                expect(received).to.eql(params);
                done();
            });
            passage.addEventListener('rpc.open', () => {
                server.send(JSON.stringify({ method, params, jsonrpc: '2.0' }));
            });
        });
        it('should send a notification', done => {
            const params = { some: 'data' };
            server.addEventListener('message', data => {
                const message = JSON.parse(data);
                expect(message).to.eql({ method, params, jsonrpc: '2.0' });
                done();
            });
            passage.addEventListener('rpc.open', () => {
                passage.send(method, params);
            });
        });
        it('should send multiple notifications', done => {
            const params1 = { some: 'data' };
            const params2 = { more: 'data' };
            server.addEventListener('message', data => {
                const message = JSON.parse(data);
                expect(message).to.eql([
                    { method, params: params1, jsonrpc: '2.0' },
                    { method, params: params2, jsonrpc: '2.0' }
                ]);
                done();
            });
            passage.addEventListener('rpc.open', () => {
                passage.sendAll([
                    { method, params: params1 },
                    { method, params: params2 },
                ]);
            });
        });
        it('should recover from invalid input', done => {
            const params = { some: 'data' };
            server.addEventListener('message', data => {
                const message = JSON.parse(data);
                expect(message).to.eql({ method, params, jsonrpc: '2.0' });
                done();
            });
            passage.addEventListener('rpc.open', () => {
                passage.sendAll([
                    () => {},
                    { method, params },
                ]);
            });
        });
    });

    describe('callbacks', () => {
        it('should receive a response', done => {
            const params = { some: 'data' };
            server.addEventListener('message', data => {
                const message = JSON.parse(data);
                expect(message).to.eql({ id: 1, method, jsonrpc: '2.0' });
                server.send(JSON.stringify({ id: 1, result: params, jsonrpc: '2.0' }));
            });
            passage.addEventListener('rpc.open', () => {
                passage.send(method, undefined, (error, result) => {
                    expect(error).to.be(undefined);
                    expect(result).to.eql(params);
                    done();
                });
            });
        });
        it('should increment id', done => {
            let id = 1;
            server.addEventListener('message', data => {
                const message = JSON.parse(data);
                expect(message.id).to.equal(id);
                server.send(JSON.stringify({ id, result: true, jsonrpc: '2.0' }));
                id++;
            });
            passage.addEventListener('rpc.open', () => {
                passage.send(method, undefined, () => {
                    passage.send(method, undefined, () => {
                        passage.send(method, undefined, () => {
                            done();
                        });
                    });
                });
            });
        });
        it('should receive an error', done => {
            const error = { code: 500, message: 'an error!', data: { hmm: 'oops' } };
            server.addEventListener('message', data => {
                const message = JSON.parse(data);
                expect(message).to.eql({ id: 1, method, jsonrpc: '2.0' });
                server.send(JSON.stringify({ id: 1, error, jsonrpc: '2.0' }));
            });
            passage.addEventListener('rpc.open', () => {
                passage.send(method, undefined, (error, result) => {
                    expect(error).to.be.an(Error);
                    expect(error.message).to.equal(error.message);
                    expect(error.code).to.equal(error.code);
                    expect(error.data).to.eql(error.data);
                    expect(result).to.be(undefined);
                    done();
                });
            });
        });
        it('should timeout on no response', done => {
            passage.addEventListener('rpc.open', () => {
                passage.send(method, undefined, (error, result) => {
                    expect(error).to.be.an(Error);
                    expect(error.message).to.equal('Timeout');
                    expect(error.code).to.equal(408);
                    expect(error.data).to.be(undefined);
                    expect(result).to.be(undefined);
                    done();
                }, 0); // Timeout set to 0 for faster test
            });
        });
        it('should run callbacks on invalid input', done => {
            const callback = error => {
                expect(error).to.be.an(Error);
                done();
            };
            passage.addEventListener('rpc.open', () => {
                passage.sendAll([
                    { method: () => {}, callback },
                    { method },
                ]);
            });
        });
    });
});
