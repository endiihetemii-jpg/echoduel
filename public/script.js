// 🔗 Lidhje automatike me serverin publik (me LocalTunnel)
const socket = io(window.location.origin.replace(/^http/, "https"), { transports: ["websocket"] });

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const startBtn = document.getElementById("startBtn");
const nextBtn = document.getElementById("nextBtn");
const switchCamBtn = document.getElementById("switchCamBtn");
const chatBox = document.getElementById("chatBox");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

let peerConnection;
let localStream;
let currentFacing = "user";
const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

async function startCamera() {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: currentFacing },
    audio: true
  });
  localVideo.srcObject = localStream;
}

startBtn.onclick = async () => {
  await startCamera();
  startBtn.disabled = true;
  nextBtn.disabled = false;
  switchCamBtn.disabled = false;
  chatBox.innerHTML = "<p>⏳ Duke kërkuar partner...</p>";
  socket.emit("next");
};

nextBtn.onclick = () => {
  socket.emit("next");
  chatBox.innerHTML = "<p>🔄 Duke kërkuar partner të ri...</p>";
  remoteVideo.srcObject = null;
};

switchCamBtn.onclick = async () => {
  currentFacing = currentFacing === "user" ? "environment" : "user";
  localStream.getTracks().forEach(track => track.stop());
  await startCamera();
  if (peerConnection) {
    const videoTrack = localStream.getVideoTracks()[0];
    const sender = peerConnection.getSenders().find(s => s.track.kind === "video");
    if (sender) sender.replaceTrack(videoTrack);
  }
};

socket.on("waiting", (msg) => {
  chatBox.innerHTML = `<p>${msg}</p>`;
});

socket.on("matched", () => {
  chatBox.innerHTML = "<p>🎥 U lidhët me një partner!</p>";
  startConnection();
});

socket.on("partner-left", () => {
  chatBox.innerHTML += "<p>❌ Partneri u largua.</p>";
  remoteVideo.srcObject = null;
});

function startConnection() {
  peerConnection = new RTCPeerConnection(config);

  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  peerConnection.ontrack = event => {
    remoteVideo.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = event => {
    if (event.candidate) socket.emit("candidate", event.candidate);
  };

  socket.on("offer", async (offer) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit("answer", answer);
  });

  socket.on("answer", async (answer) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  });

  socket.on("candidate", async (candidate) => {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  });

  createOffer();
}

async function createOffer() {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit("offer", offer);
}

// CHAT
sendBtn.onclick = sendMessage;
messageInput.addEventListener("keypress", e => { if (e.key === "Enter") sendMessage(); });

function sendMessage() {
  const message = messageInput.value;
  if (message.trim() === "") return;
  appendMessage("Ti", message);
  socket.emit("message", message);
  messageInput.value = "";
}

socket.on("message", msg => appendMessage("Tjetri", msg));

function appendMessage(sender, message) {
  const div = document.createElement("div");
  div.textContent = `${sender}: ${message}`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}
