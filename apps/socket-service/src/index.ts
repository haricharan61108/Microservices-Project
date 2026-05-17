import { WebSocketServer } from "ws";

const wss = new WebSocketServer({
    port: 8080
})

const clients = new Map<string, any>();

wss.on("connection", (ws)=> {
    console.log("Client Connected");

    ws.on("message", (message) => {
        const data = JSON.parse(message.toString());

    if (data.type === "REGISTER") {

        clients.set(data.userId, ws);
  
        console.log(
          `User Registered: ${data.userId}`
        );
      }

      if(data.type === "VIDEO_STATUS") {
        const targetWs = clients.get(data.userId);

        if(targetWs) {
          targetWs.send(
            JSON.stringify({
              type: "VIDEO_STATUS",
              videoId : data.videoId,
              status: data.status
            })
          )
        }
      }

    });

    ws.on("close", () => {
        console.log("Client Disconnected");
      });
})

console.log(
  "Socket Service running on port 8080"
);

export { clients };