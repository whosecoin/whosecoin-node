const Network = require('../src/network')

let options = {
    port: 1960,
    initial_connections: [],
}

process.argv.forEach((val) => {
    if (val.match(/-port=[0-9]+/)) {
        options.port = parseInt(val.split('=')[1])
    } else if (val.match(/-connect=[0-9.:]*/)) {
        options.initial_connections.push(val.split('=')[1])
    }
});

const network = new Network({port: options.port});

options.initial_connections.forEach((peer) => network.connect(peer))

network.on('connect', (peer) => {

    network.send(peer, {
        kind: "handshake",
        version: options.VERSION_STRING,
        listens: true,
        listeningPort: options.port,
    });
    
    network.send(peer, {
        kind: "peer-discovery-request"
    })

});

network.on('handshake', (message, peer) => {
    
    if (message.version != options.VERSION_STRING) {
        network.send(peer, {
            kind: "error",
            message: "incompatible version"
        });
        network.destroy_connection(peer);
        return;
    }

    // check if the peer accepts incoming connections
    if (message.listens && message.listeningPort) {
        peer.data.listens = true;
        peer.data.listeningPort = message.listeningPort;
    } else {
        peer.data.listens = false;
    }

    const addr = peer.remoteAddress;
    const port = message.listens ? peer.data.listeningPort: peer.remotePort;
    console.log(`[+] ${addr}:${port}`)

})

network.on('disconnect', (peer) => {
    const addr = peer.remoteAddress;
    const port = peer.data.listens ? peer.data.listeningPort: peer.remotePort;
    console.log(`[-] ${addr}:${port}`)
})

network.on('peer-discovery-request', (message, peer) => {

    const peers = network.nodes.filter(n => n.data && n.data.listens)
                               .map(n => `${n.remoteAddress}:${n.data.listeningPort}`);

    network.send(peer, {
        kind: "peer-discovery-response",
        peers: peers
    })
})

network.on('peer-discovery-response', (message) => {

    const peers = network.nodes.filter(n => n.data && n.data.listens)
                               .map(n => `${n.remoteAddress}:${n.data.listeningPort}`);

    message.peers.forEach((peer) => {
        
        if (peers.includes(peer)) return;
        if (peer == `127.0.0.1:${options.port}`) return;

        network.connect(peer)
    });
});

network.on('error', (message) => {
    console.error(`error: ${message.message}`);
});
