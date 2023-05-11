/********************************************************************************
 * Copyright (c) 2023 Contributors to the Eclipse Foundation
 *
 * See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0, or the W3C Software Notice and
 * Document License (2015-05-13) which is available at
 * https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document.
 *
 * SPDX-License-Identifier: EPL-2.0 OR W3C-20150513
 ********************************************************************************/

/**
 * Protocol test suite to test protocol implementations
 */

import { createInfoLogger, ProtocolHelpers, Servient } from "@node-wot/core";
import { expect, should } from "chai";
import MqttBrokerServer from "../src/mqtt-broker-server";
import MqttClientFactory from "../src/mqtt-client-factory";
import MqttsClientFactory from "../src/mqtts-client-factory";

const info = createInfoLogger("binding-mqtt", "mqtt-client-subscribe-test.integration");

// should must be called to augment all variables
should();

describe("MQTT client implementation", () => {
    let servient: Servient;
    let brokerServer: MqttBrokerServer;

    const brokerAddress = "localhost";
    const brokerPort = 1889;
    const brokerUri = `mqtt://${brokerAddress}:${brokerPort}`;

    beforeEach(() => {
        servient = new Servient();
    });

    afterEach(async () => {
        await servient.shutdown();
        await brokerServer.stop();
    });

    it("should expose via broker", (done: Mocha.Done) => {
        brokerServer = new MqttBrokerServer({ uri: brokerUri, selfHost: true });
        servient.addServer(brokerServer);

        servient.addClientFactory(new MqttClientFactory());

        servient.start().then((WoT) => {
            expect(brokerServer.getPort()).to.equal(brokerPort);
            expect(brokerServer.getAddress()).to.equal(brokerAddress);

            const eventNumber = Math.floor(Math.random() * 1000000);
            const eventName: string = "event" + eventNumber;
            const events: { [key: string]: Record<string, unknown> } = {};
            events[eventName] = { data: { type: "number" } };

            WoT.produce({
                title: "TestWoTMQTT",
                events: events,
            }).then((thing) => {
                thing.expose().then(() => {
                    info(`Exposed ${thing.getThingDescription().title}`);

                    WoT.consume(thing.getThingDescription()).then((client) => {
                        let check = 0;
                        let eventReceived = false;

                        client
                            .subscribeEvent(eventName, (x) => {
                                if (!eventReceived) {
                                    eventReceived = true;
                                } else {
                                    ProtocolHelpers.readStreamFully(ProtocolHelpers.toNodeStream(x.data)).then(
                                        (received) => {
                                            expect(JSON.parse(received.toString())).to.equal(++check);
                                            if (check === 3) thing.destroy().then(() => done());
                                        }
                                    );
                                }
                            })
                            .then(() => {
                                for (let i = 0; i < 4; i++) {
                                    thing.emitEvent(eventName, i);
                                }
                            })
                            .catch((e) => {
                                expect(true).to.equal(false);
                            });
                    });
                });
            });
        });
    }).timeout(20000);

    it("should expose via broker using mqtts", (done: Mocha.Done) => {
        brokerServer = new MqttBrokerServer({
            uri: brokerUri,
            selfHost: true,
            key: undefined /** fs.readFileSync("your_key.pem") */,
        });
        servient.addServer(brokerServer);

        servient.addClientFactory(new MqttClientFactory());
        servient.addClientFactory(new MqttsClientFactory({ rejectUnauthorized: false }));

        servient.start().then((WoT) => {
            expect(brokerServer.getPort()).to.equal(brokerPort);
            expect(brokerServer.getAddress()).to.equal(brokerAddress);

            const eventNumber = Math.floor(Math.random() * 1000000);
            const eventName: string = "event" + eventNumber;
            const events: { [key: string]: Record<string, unknown> } = {};
            events[eventName] = { data: { type: "number" } };

            WoT.produce({
                title: "TestWoTMQTT",
                events: events,
            }).then((thing) => {
                thing.expose().then(() => {
                    info(`Exposed ${thing.getThingDescription().title}`);

                    WoT.consume(thing.getThingDescription()).then((client) => {
                        let check = 0;
                        let eventReceived = false;

                        client
                            .subscribeEvent(eventName, (x) => {
                                if (!eventReceived) {
                                    eventReceived = true;
                                } else {
                                    ProtocolHelpers.readStreamFully(ProtocolHelpers.toNodeStream(x.data)).then(
                                        (received) => {
                                            expect(JSON.parse(received.toString())).to.equal(++check);
                                            if (check === 3) done();
                                        }
                                    );
                                }
                            })
                            .then(() => {
                                for (let i = 0; i < 4; i++) {
                                    thing.emitEvent(eventName, i);
                                }
                            })
                            .catch((e) => {
                                expect(true).to.equal(false);
                            });
                    });
                });
            });
        });
    }).timeout(20000);

    it("should write property (string)", (done: Mocha.Done) => {
        brokerServer = new MqttBrokerServer({ uri: brokerUri, selfHost: true });
        servient.addServer(brokerServer);

        servient.addClientFactory(new MqttClientFactory());

        servient.start().then((WoT) => {
            expect(brokerServer.getPort()).to.equal(brokerPort);
            expect(brokerServer.getAddress()).to.equal(brokerAddress);

            const propertyNumber = Math.floor(Math.random() * 1000000);
            const propertyName: string = "property" + propertyNumber;
            const properties: { [key: string]: Record<string, unknown> } = {};
            properties[propertyName] = {
                type: "string",
                observable: true,
                readOnly: false,
                writeOnly: true,
            };

            WoT.produce({
                title: "TestWoTMQTT",
                properties: properties,
            }).then((thing) => {
                let receivedInput = "";

                thing.setPropertyWriteHandler(propertyName, async (inputData) => {
                    receivedInput = (await inputData.value()) as string;
                });

                thing.expose().then(() => {
                    info(`Exposed ${thing.getThingDescription().title}`);

                    WoT.consume(thing.getThingDescription()).then((client) => {
                        const input = "writeProperty";

                        client
                            .writeProperty(propertyName, input)
                            .then(() => {
                                setTimeout(() => {
                                    expect(input).to.equal(receivedInput);
                                    thing.destroy().then(() => done());
                                }, 20);
                            })
                            .catch((e) => {
                                expect(true).to.equal(false);
                            });
                    });
                });
            });
        });
    }).timeout(20000);

    it("should write property (number)", (done: Mocha.Done) => {
        brokerServer = new MqttBrokerServer({ uri: brokerUri, selfHost: true });
        servient.addServer(brokerServer);

        servient.addClientFactory(new MqttClientFactory());

        servient.start().then((WoT) => {
            expect(brokerServer.getPort()).to.equal(brokerPort);
            expect(brokerServer.getAddress()).to.equal(brokerAddress);

            const propertyNumber = Math.floor(Math.random() * 1000000);
            const propertyName: string = "property" + propertyNumber;
            const properties: { [key: string]: Record<string, unknown> } = {};
            properties[propertyName] = {
                type: "number",
                observable: true,
                readOnly: false,
                writeOnly: true,
            };

            WoT.produce({
                title: "TestWoTMQTT",
                properties: properties,
            }).then((thing) => {
                let receivedInput: number;

                thing.setPropertyWriteHandler(propertyName, async (inputData) => {
                    receivedInput = (await inputData.value()) as number;
                });

                thing.expose().then(() => {
                    info(`Exposed ${thing.getThingDescription().title}`);

                    WoT.consume(thing.getThingDescription()).then((client) => {
                        const input = 1337;

                        client
                            .writeProperty(propertyName, input)
                            .then(() => {
                                setTimeout(() => {
                                    expect(input).to.equal(receivedInput);
                                    thing.destroy().then(() => done());
                                }, 20);
                            })
                            .catch((e) => {
                                expect(true).to.equal(false);
                            });
                    });
                });
            });
        });
    }).timeout(20000);

    it("should write property (array)", (done: Mocha.Done) => {
        brokerServer = new MqttBrokerServer({ uri: brokerUri, selfHost: true });
        servient.addServer(brokerServer);

        servient.addClientFactory(new MqttClientFactory());

        servient.start().then((WoT) => {
            expect(brokerServer.getPort()).to.equal(brokerPort);
            expect(brokerServer.getAddress()).to.equal(brokerAddress);

            const propertyNumber = Math.floor(Math.random() * 1000000);
            const propertyName: string = "property" + propertyNumber;
            const properties: { [key: string]: Record<string, unknown> } = {};
            properties[propertyName] = {
                type: "array",
                observable: true,
                readOnly: false,
                writeOnly: true,
            };

            WoT.produce({
                title: "TestWoTMQTT",
                properties: properties,
            }).then((thing) => {
                let receivedInput: [];

                thing.setPropertyWriteHandler(propertyName, async (inputData) => {
                    receivedInput = (await inputData.value()) as [];
                });

                thing.expose().then(() => {
                    info(`Exposed ${thing.getThingDescription().title}`);

                    WoT.consume(thing.getThingDescription()).then((client) => {
                        const input = [1, 3, 3, 7];

                        client
                            .writeProperty(propertyName, input)
                            .then(() => {
                                setTimeout(() => {
                                    expect(input).to.eql(receivedInput);
                                    thing.destroy().then(() => done());
                                }, 20);
                            })
                            .catch((e) => {
                                expect(true).to.equal(false);
                            });
                    });
                });
            });
        });
    }).timeout(20000);

    it("should write property (object)", (done: Mocha.Done) => {
        brokerServer = new MqttBrokerServer({ uri: brokerUri, selfHost: true });
        servient.addServer(brokerServer);

        servient.addClientFactory(new MqttClientFactory());

        servient.start().then((WoT) => {
            expect(brokerServer.getPort()).to.equal(brokerPort);
            expect(brokerServer.getAddress()).to.equal(brokerAddress);

            const propertyNumber = Math.floor(Math.random() * 1000000);
            const propertyName: string = "property" + propertyNumber;
            const properties: { [key: string]: Record<string, unknown> } = {};
            properties[propertyName] = {
                type: "object",
                observable: true,
                readOnly: false,
                writeOnly: true,
            };

            WoT.produce({
                title: "TestWoTMQTT",
                properties: properties,
            }).then((thing) => {
                let receivedInput: Record<string, unknown>;

                thing.setPropertyWriteHandler(propertyName, async (inputData) => {
                    receivedInput = (await inputData.value()) as Record<string, unknown>;
                });

                thing.expose().then(() => {
                    info(`Exposed ${thing.getThingDescription().title}`);

                    WoT.consume(thing.getThingDescription()).then((client) => {
                        const input = {
                            test_number: 23,
                            test_string: "test",
                            test_array: ["t", "e", "s", "t"],
                        };

                        client
                            .writeProperty(propertyName, input)
                            .then(() => {
                                setTimeout(() => {
                                    expect(input).to.eql(receivedInput);
                                    thing.destroy().then(() => done());
                                }, 20);
                            })
                            .catch((e) => {
                                expect(true).to.equal(false);
                            });
                    });
                });
            });
        });
    }).timeout(20000);

    it("should invoke action (string)", (done: Mocha.Done) => {
        brokerServer = new MqttBrokerServer({ uri: brokerUri, selfHost: true });
        servient.addServer(brokerServer);

        servient.addClientFactory(new MqttClientFactory());

        servient.start().then((WoT) => {
            expect(brokerServer.getPort()).to.equal(brokerPort);
            expect(brokerServer.getAddress()).to.equal(brokerAddress);

            const actionNumber = Math.floor(Math.random() * 1000000);
            const actionName: string = "action" + actionNumber;
            const actions: { [key: string]: Record<string, unknown> } = {};
            actions[actionName] = { input: { type: "string" } };

            WoT.produce({
                title: "TestWoTMQTT",
                actions: actions,
            }).then((thing) => {
                let receivedInput = "";

                thing.setActionHandler(actionName, async (inputData) => {
                    receivedInput = (await inputData.value()) as string;

                    return receivedInput;
                });

                thing.expose().then(() => {
                    info(`Exposed ${thing.getThingDescription().title}`);

                    WoT.consume(thing.getThingDescription()).then((client) => {
                        const input = "invokeAction";

                        client
                            .invokeAction(actionName, input)
                            .then((res) => {
                                res.value().then(() => {
                                    setTimeout(() => {
                                        expect(input).to.equal(receivedInput);
                                        thing.destroy().then(() => done());
                                    }, 20);
                                });
                            })
                            .catch((e) => {
                                expect(true).to.equal(false);
                            });
                    });
                });
            });
        });
    }).timeout(20000);

    it("should invoke action (number)", (done: Mocha.Done) => {
        brokerServer = new MqttBrokerServer({ uri: brokerUri, selfHost: true });
        servient.addServer(brokerServer);

        servient.addClientFactory(new MqttClientFactory());

        servient.start().then((WoT) => {
            expect(brokerServer.getPort()).to.equal(brokerPort);
            expect(brokerServer.getAddress()).to.equal(brokerAddress);

            const actionNumber = Math.floor(Math.random() * 1000000);
            const actionName: string = "action" + actionNumber;
            const actions: { [key: string]: Record<string, unknown> } = {};
            actions[actionName] = { input: { type: "number" } };

            WoT.produce({
                title: "TestWoTMQTT",
                actions: actions,
            }).then((thing) => {
                let receivedInput: number;

                thing.setActionHandler(actionName, async (inputData) => {
                    receivedInput = (await inputData.value()) as number;

                    return receivedInput;
                });

                thing.expose().then(() => {
                    info(`Exposed ${thing.getThingDescription().title}`);

                    WoT.consume(thing.getThingDescription()).then((client) => {
                        const input = 1337;

                        client
                            .invokeAction(actionName, input)
                            .then((res) => {
                                res.value().then(() => {
                                    setTimeout(() => {
                                        expect(input).to.equal(receivedInput);
                                        thing.destroy().then(() => done());
                                    }, 20);
                                });
                            })
                            .catch((e) => {
                                expect(true).to.equal(false);
                            });
                    });
                });
            });
        });
    }).timeout(20000);

    it("should invoke action (array)", (done: Mocha.Done) => {
        brokerServer = new MqttBrokerServer({ uri: brokerUri, selfHost: true });
        servient.addServer(brokerServer);

        servient.addClientFactory(new MqttClientFactory());

        servient.start().then((WoT) => {
            expect(brokerServer.getPort()).to.equal(brokerPort);
            expect(brokerServer.getAddress()).to.equal(brokerAddress);

            const actionNumber = Math.floor(Math.random() * 1000000);
            const actionName: string = "action" + actionNumber;
            const actions: { [key: string]: Record<string, unknown> } = {};
            actions[actionName] = { input: { type: "array" } };

            WoT.produce({
                title: "TestWoTMQTT",
                actions: actions,
            }).then((thing) => {
                let receivedInput: [];

                thing.setActionHandler(actionName, async (inputData) => {
                    receivedInput = (await inputData.value()) as [];

                    return receivedInput;
                });

                thing.expose().then(() => {
                    info(`Exposed ${thing.getThingDescription().title}`);

                    WoT.consume(thing.getThingDescription()).then((client) => {
                        const input = [1, 3, 3, 7];

                        client
                            .invokeAction(actionName, input)
                            .then((res) => {
                                res.value().then(() => {
                                    setTimeout(() => {
                                        expect(input).to.eql(receivedInput);
                                        thing.destroy().then(() => done());
                                    }, 20);
                                });
                            })
                            .catch((e) => {
                                expect(true).to.equal(false);
                            });
                    });
                });
            });
        });
    }).timeout(20000);

    it("should invoke action (object)", (done: Mocha.Done) => {
        brokerServer = new MqttBrokerServer({ uri: brokerUri, selfHost: true });
        servient.addServer(brokerServer);

        servient.addClientFactory(new MqttClientFactory());

        servient.start().then((WoT) => {
            expect(brokerServer.getPort()).to.equal(brokerPort);
            expect(brokerServer.getAddress()).to.equal(brokerAddress);

            const actionNumber = Math.floor(Math.random() * 1000000);
            const actionName: string = "action" + actionNumber;
            const actions: { [key: string]: Record<string, unknown> } = {};
            actions[actionName] = { input: { type: "object" } };

            WoT.produce({
                title: "TestWoTMQTT",
                actions: actions,
            }).then((thing) => {
                let receivedInput: Record<string, unknown>;

                thing.setActionHandler(actionName, async (inputData) => {
                    receivedInput = (await inputData.value()) as Record<string, unknown>;

                    return receivedInput;
                });

                thing.expose().then(() => {
                    info(`Exposed ${thing.getThingDescription().title}`);

                    WoT.consume(thing.getThingDescription()).then((client) => {
                        const input = {
                            test_number: 23,
                            test_string: "test",
                            test_array: ["t", "e", "s", "t"],
                        };

                        client
                            .invokeAction(actionName, input)
                            .then((res) => {
                                res.value().then(() => {
                                    setTimeout(() => {
                                        expect(input).to.eql(receivedInput);
                                        thing.destroy().then(() => done());
                                    }, 20);
                                });
                            })
                            .catch((e) => {
                                expect(true).to.equal(false);
                            });
                    });
                });
            });
        });
    }).timeout(20000);
});
