import React, { useState, useRef, useEffect } from "react";
import { io } from "socket.io-client";

const socket = io("http://192.168.1.9:8000");

const Home = () => {
    const [selectedInterests, setSelectedInterests] = useState([]);
    const [room, setRoom] = useState(null);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerConnection = useRef(null);

    const ICE_SERVERS = {
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" }
        ]
    };

    useEffect(() => {
        socket.on("match-found", ({ room }) => {
            setRoom(room);
            startWebRTC();
        });
    
        socket.on("offer", async ({ sdp }) => {
            if (!peerConnection.current) startWebRTC();
    
            const currentState = peerConnection.current.signalingState;
    
            if (currentState === "stable" || currentState === "have-local-offer") {
                await peerConnection.current.setRemoteDescription(new RTCSessionDescription(sdp));
                const answer = await peerConnection.current.createAnswer();
                await peerConnection.current.setLocalDescription(answer);
                socket.emit("answer", { sdp: answer, room });
            }
        });
    
        socket.on("answer", async ({ sdp }) => {
            const currentState = peerConnection.current.signalingState;
            if (currentState === "have-remote-offer") {
                await peerConnection.current.setRemoteDescription(new RTCSessionDescription(sdp));
            }
        });
    
        socket.on("ice-candidate", ({ candidate }) => {
            if (peerConnection.current) {
                peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
            }
        });
    
        return () => {
            socket.off("match-found");
            socket.off("offer");
            socket.off("answer");
            socket.off("ice-candidate");
        };
    }, [room]);

    const handleInterestClick = (interest) => {
        setSelectedInterests((prev) =>
            prev.includes(interest) ? prev.filter((item) => item !== interest) : [...prev, interest]
        );
    };

    const startCall = () => {
        socket.emit("find-match", { interests: selectedInterests });
    };

    const startWebRTC = async () => {
        peerConnection.current = new RTCPeerConnection(ICE_SERVERS);

        peerConnection.current.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("ice-candidate", { candidate: event.candidate, room });
            }
        };

        peerConnection.current.ontrack = (event) => {
            remoteVideoRef.current.srcObject = event.streams[0];
        };

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localVideoRef.current.srcObject = stream;

            stream.getTracks().forEach((track) => {
                peerConnection.current.addTrack(track, stream);
            });

            if (room) {
                const offer = await peerConnection.current.createOffer();
                await peerConnection.current.setLocalDescription(offer);
                socket.emit("offer", { sdp: offer, room });
            }
        } catch (error) {
            console.error("Error accessing media devices:", error);
        }
    };

    return (
        <div className="homepage-container">
            <div className="input-container">
                <h1>What are your interests?</h1>
                {["Foodie", "Nature lover", "Dancing", "Singing", "Travelling", "Blogging", "Stand-up"].map((interest) => (
                    <button
                        key={interest}
                        onClick={() => handleInterestClick(interest)}
                        className={selectedInterests.includes(interest) ? "selected" : ""}
                    >
                        {interest}
                    </button>
                ))}
                <button className="call" onClick={startCall}>
                    Start Call
                </button>
            </div>

            {room && (
                <div className="video-container">
                    <video ref={localVideoRef} autoPlay playsInline muted />
                    <video ref={remoteVideoRef} autoPlay playsInline />
                </div>
            )}
        </div>
    );
};

export default Home;
