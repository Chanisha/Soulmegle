const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const bodyParser = require("body-parser");


const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

app.use(bodyParser.json());

app.get("/", (req, res) => {
    res.send("Server is running");
});

let waitingUsers = [];

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("find-match", ({ interests }) => {
        let match = null;

        for (let i = 0; i < waitingUsers.length; i++) {
            const user = waitingUsers[i];
            const commonInterests = user.interests.filter((interest) => interests.includes(interest));

            if (commonInterests.length > 0) {
                match = user;
                waitingUsers.splice(i, 1);
                break;
            }
        }

        if (match) {
            socket.emit("match-found", { room: match.socketId });
            io.to(match.socketId).emit("match-found", { room: socket.id });
        } else {
            waitingUsers.push({ socketId: socket.id, interests });
        }
    });

    socket.on("offer", (data) => {
        io.to(data.room).emit("offer", data);
    });

    socket.on("answer", (data) => {
        io.to(data.room).emit("answer", data);
    });

    socket.on("ice-candidate", (data) => {
        io.to(data.room).emit("ice-candidate", data);
    });

    socket.on("disconnect", () => {
        waitingUsers = waitingUsers.filter((user) => user.socketId !== socket.id);
        console.log("User disconnected:", socket.id);
    });
});

server.listen(8000, "0.0.0.0", () => console.log("Server running on port 8000"));

