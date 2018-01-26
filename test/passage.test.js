const expect = require('expect.js');
const { Server, WebSocket } = require('mock-socket');
const passageClient = require('../src/passage-client');

const Passage = passageClient(WebSocket);

const URI = 'ws://fake-server.io';
const DEFAULT_OPTIONS = {
    requestTimeout: 6000,
    reconnect: false,
    reconnectTimeout: 2000,
    reconnectTries: 60
};

describe('passage', () => {
    let server;

    beforeEach(() => {
        server = new Server(URI);
    });
    afterEach(() => {
        server.close();
    });

    describe('defaults', () => {
        let passage;

        beforeEach(() => {
            passage = new Passage(URI);
        });

        it('should create an instance', () => {
            expect(passage.uri).to.equal(URI);
            expect(passage.options).to.eql(DEFAULT_OPTIONS);
            expect(passage.connection).to.be.a(WebSocket);
        });
        it('should add event listener', () => {
            const name = 'my.event';
            const handler = () => {};
            passage.addEventListener(name, handler);
            expect(passage._events[name].length).to.equal(1);
            expect(passage._events[name][0]).to.equal(handler);
        });
        it('should remove event listener', () => {
            const name = 'my.event';
            const handler1 = () => {};
            const handler2 = () => {};
            passage.addEventListener(name, handler1);
            passage.addEventListener(name, handler2);
            passage.removeEventListener(name, handler1);
            expect(passage._events[name].length).to.equal(1);
            expect(passage._events[name][0]).to.equal(handler2);
            passage.removeEventListener(name, handler2);
            expect(passage._events[name]).to.be(undefined);
        });
        it('should trigger rpc.open on connection', done => {
            passage.addEventListener('rpc.open', done);
        });
        it('should trigger rpc.close on close', done => {
            passage.addEventListener('rpc.open', () => { passage.close(); });
            passage.addEventListener('rpc.close', done);
        });
        it('should trigger rpc.error on error', done => {
            passage.addEventListener('rpc.error', () => { done(); });
            server.simulate('error');
        });
        it('should trigger rpc.message on message', done => {
            const text = 'some text';
            passage.addEventListener('rpc.message', (message) => {
                expect(message).to.equal(text);
                done();
            });
            passage.addEventListener('rpc.open', () => { server.send(text); });
        });
    });
    describe('custom options', () => {
        it('should create an instance with custom options', () => {
            const options = {
                requestTimeout: 600,
                reconnect: true,
                reconnectTimeout: 200,
                reconnectTries: 6
            };
            const passage = new Passage(URI, options);
            expect(passage.uri).to.equal(URI);
            expect(passage.options).to.eql(options);
            expect(passage.connection).to.be.a(WebSocket);
            passage.close();
        });
        it('should ignore invalid input', () => {
            const NOT_NUMBERS = ['1', null, true, false, () => {}, undefined];
            for (const value of NOT_NUMBERS) {
                const options = {
                    requestTimeout: value,
                    reconnect: false,
                    reconnectTimeout: value,
                    reconnectTries: value
                };
                const passage = new Passage(URI, options);
                expect(passage.uri).to.equal(URI);
                expect(passage.options).to.eql(DEFAULT_OPTIONS);
            }
        });
        it('should reconnect', done => {
            const passage = new Passage(URI, { reconnect: true, reconnectTimeout: 0 });
            let count = 0;
            passage.addEventListener('rpc.open', () => {
                if (count === 0) {
                    server.close();
                } else {
                    done();
                    passage.close();
                }
            });
            passage.addEventListener('rpc.close', () => {
                if (count === 2) server = new Server(URI);
                count++;
            });
        });
    });
});
