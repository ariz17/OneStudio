# 🎙️ Master Interview Presentation Script — OneStudios



## STUN = Session Traversal Utilities for NAT
It helps a device discover its public IP address and port so WebRTC can try to establish a direct connection.

**Simple example:**
Your laptop → Router/NAT → Internet
STUN tells your laptop: "Your public address is X:X."




## TURN = Traversal Using Relays around NAT
If WebRTC cannot establish a direct connection, TURN acts as a relay server.
Forwards connection when direct connection fails.

**Simple Example**
Without TURN:
A ───────────> B

If direct connection fails:
A ──> TURN Server ──> B




## WebRTC (Web Real-Time Communication) 
It is a technology that allows browsers/apps to do real-time audio, video, and data communication without needing a traditional video-call service.
It handles real-time communication between browsers.
**WebSocket** is a communication protocol that creates a persistent, two-way connection between the client and server.



## SFU (Selective Forwarding Unit) 
It is a server that receives video/audio from participants and forwards it to the other participants without mixing it.

**Simple Example**
For 3 people:
Person A ──┐
Person B ──┼──> SFU ──> A, B, C
Person C ──┘

Instead of A sending directly to B and C separately, everyone sends their stream to the SFU, and the SFU forwards the required streams.




## NAT = Network Address Translation
It is a technique used by a router to allow multiple devices in a private network to share one public IP address on the internet.

**Simple Example**
Laptop      192.168.1.10 ─┐
Phone       192.168.1.11 ─┼──> Router (NAT) ──> Internet
TV          192.168.1.12 ─┘

**NOTE:**
In WebRTC, NAT can make it difficult for two devices to connect directly.
That's why WebRTC uses:
STUN → discover how to reach the device through NAT
TURN → relay traffic when direct connection through NAT fails




## 1. Introduction

"Good morning.

My name is Mohd Arbab Rizvi, and today I’m going to present my project, **OneStudios**.

OneStudios is a full-stack and real-time video conferencing platform, designed and built entirely without using any third-party Video SDKs like Twilio or Agora.
Twilio and Agora are cloud platforms that provide developer tools (APIs and SDKs) to add real-time voice, video, and messaging features into mobile and web apps.


## 2. Why I Built OneStudios

In a normal web application, we usually send a request to the server and get a response.

But in a video meeting, many things are happening continuously — video, audio, chat, screen sharing, and participant updates.

<!-- So I wanted to understand how these things work together. -->

For 1:1 video calling, I used native WebRTC, and for scalable group calls, I used mediasoup.

<!-- Another reason to build this was cost and infrastructure control. -->

Apps like Zoom offer only 40 minutes per meeting session on their free plans. For longer sessions, users are required to purchase a paid plan, that can cost around ₹1300–₹1500 per user per month.

Similarly third-party video services / SDK's like Agora or Twilio also charge based on video usage, such as participant-minutes. As the number of users and meeting hours increase, these costs can also increase.

**SDK = Set of tools programmers use to make apps. It can include libraries, API's, documentation, debug tools etc.**
**API = Application Programming Interface = A way of 2 different software programs to talk to each other.**

So instead of using a ready-made video SDK ($0.004 for an hour with 10 participants using twilio or $0.032 for agora), I built the video layer using native WebRTC and a self-hosted mediasoup SFU for group calls.

This allowed me to avoid third-party video API charges and also gave us more control over how the video system works.


## 3. Main Features
"OneStudios has several features.


## 1:1 Calls & Group Meetings
>Users can make 1:1 or group video/audio calls with up to 10 people.
>WebRTC handles real-time communication between browsers.
>Mediasoup SFU manages and forwards video streams efficiently in group calls.
>Simple: WebRTC = real-time communication , mediasoup = manages group video streams.

## Screen Sharing
>Users can share their entire screen, a window, or a browser tab.
>Useful for presenting PPTs, code, or demonstrations.
>WebRTC sends the shared screen to other participants in real time.

## Local Browser Recording
>The meeting can be recorded directly on the user's device.
>Video feeds are combined using an HTML5 Canvas using captureStream() method.
>The final recording is saved locally on the laptop using MediaRecorder API, 
 so it doesn't need to be uploaded to a server.
>Benefit: Better privacy and no server-side storage required.

## P2P File Sharing
>Users can send files directly from one browser to another.
>Uses WebRTC RTCDataChannel.
>The file doesn't need to pass through a central server.
>Converts video / file to ArrayBuffer and divides to 128kb chunks.
>On other browser, its received in chunks and reconstructed to original.
>Simple: Browser A → Browser B directly.

## AI Productivity — Gemini
>Live Transcript: Web Speech API converts real-time speech into text captions.
>AI Summaries: Gemini summarizes the meeting transcript.
>Action Items: Identifies tasks discussed during the meeting.
>Smart Replies: Suggests quick responses for chat messages.
>Simple: Speech API creates live transcript → Gemini generates summaries & notes.

## Collaboration & Engagement
<!-- 1. Whiteboard: -->
>Participants can draw/write together in real time.
>WebSockets synchronize everyone's changes.

<!-- 2. Emoji Reactions: -->
>Users can send reactions like 👍 ❤️ 😂.
>They appear as floating animations/particles for other participants.

<!-- 3. Virtual Backgrounds: -->
>Uses MediaPipe to detect the person from the background.
>The background can then be blurred or replaced.
>Simple: MediaPipe identifies you → separates you from the background → applies blur/background effect.

## Meeting Analytics Dashboard
>Users can see stats and history of their past meetings.
>Shows total meetings held, time spent in calls, and participant details.
>Uses Recharts to display visual graphs and charts.
>Simple: Dashboard = meeting history + call stats + visual graphs.




## 4. How Video Calling Works

"Let me explain how the video calling works.

I used **WebRTC**, which is a native browser technology for real-time audio and video communication.

When two users want to connect, they first need to exchange connection information like SDP offers, answers, and ICE candidates.

For this, I created a **WebSocket** server.

The WebSocket server acts as a signaling layer — it helps users exchange connection details to establish the WebRTC peer connection.

After the connection is established, the actual video and audio data flow directly between the browsers using WebRTC.

So, WebSockets are mainly used for signaling, not for sending the actual video."

---

## 5. How Group Calls Work

"For one-to-one calls, direct peer-to-peer WebRTC works really well.

But for group calls, there is a scalability problem with pure mesh WebRTC.

For example, if five people are in a call, each person needs to send their video to four other people ($N \times (N-1)$ streams). As participants increase, this uses too much upload bandwidth and CPU power on each computer.

To solve this, I integrated **mediasoup**.

mediasoup works as an **SFU** (Selective Forwarding Unit).

Each user sends their video stream **once** to the mediasoup server. The server then efficiently forwards that video stream to the other participants.

This reduces client upload overhead and makes group calls much more scalable."

---

## 6. Local Recording

"One feature I am particularly proud of is local recording.

Normally, a meeting application sends video feeds to a backend cloud rendering server (like AWS EC2), where it is processed and stored at high cost.

I wanted to avoid server rendering costs completely.

So I created the recording pipeline 100% inside the browser.

I use an HTML5 `<canvas>` to combine participant videos into a single grid layout, and the `AudioContext` API to mix audio tracks.

Then I use the browser's `MediaRecorder` API to capture the canvas stream into a high-quality WebM file.

The recording is saved directly on the user's device, so no video file ever needs to be uploaded to my server."

---

## 7. File Sharing

"I also added direct file sharing using WebRTC **`RTCDataChannel`**.

Instead of uploading a file to my backend server first, users can transfer files directly between their browsers.

For large files, I divide the file into 128 KB ArrayBuffer chunks and send those chunks sequentially over the data channel.

I also implemented backpressure control using `bufferedAmountLowThreshold` so data is not sent faster than the connection can handle."

---

## 8. AI Features

"I also wanted to add AI capabilities to the application.

During the meeting, the application generates a live transcript using the browser's Speech API.

After the meeting ends, I send the transcript to **Google Gemini**. Gemini analyzes the transcript to generate a short summary, key discussion points, and actionable tasks.

I also added AI smart replies, where Gemini analyzes the live conversation and suggests 3 contextual quick-response buttons in the chat.

The AI system is decoupled from the video engine—WebRTC handles video/audio media, while Gemini processes text transcripts."

---

## 9. Privacy Features

"Privacy was a major focus area.

First, meeting recordings are generated locally inside the browser instead of being stored on cloud servers.

Second, I added End-to-End Encryption (E2EE) for in-call chat using the browser's **Web Crypto API** (ECDH key exchange + AES-GCM-256). The server never sees chat messages in plain text.

## 10. Virtual Background and Whiteboard

"For virtual backgrounds, I used **MediaPipe** to perform real-time selfie segmentation inside the browser. This allows background blur or image replacement to run locally on the user's device without sending video frames to an external processing server.

I also built a collaborative whiteboard. When a user draws on the canvas, drawing deltas are broadcast via WebSockets so all participants see updates instantly."

---

## 11. Backend and Database

"For the backend, I used **Node.js** and **Express 5**.

For data persistence, I used **PostgreSQL** hosted on Neon, paired with **Prisma 7 ORM**.

I store persistent data like user accounts, room configurations, active meeting states, and past history in PostgreSQL.

For authentication, I implemented salted **bcrypt** password hashing and **JWT access/refresh tokens** stored securely in `httpOnly` cookies."

---

## 12. Deployment

"The application is fully containerized and deployed using **Docker** and Docker Compose.

During deployment, I learned that real-time WebRTC apps have unique infrastructure requirements compared to standard REST apps.

For instance, WebRTC requires proper NAT traversal (STUN/TURN) and firewall configurations, while `mediasoup` workers require sufficient CPU threads and open UDP port ranges for media routing."

---

## 13. The Hardest Part

"The hardest part of this project was managing real-time connection lifecycle states.

I had to handle complex edge cases like:
- Users joining or leaving mid-call
- Toggling camera or microphone on/off dynamically
- Switching between webcam feed and screen sharing
- Gracefully handling sudden network disconnects
- Cleaning up mediasoup transports, producers, consumers, and WebRTC peer connections on unmount

Building a robust signaling queue to serialize these state transitions taught me a lot about real-time system architecture."

---

## 14. What I Learned

"The biggest takeaway from this project was seeing how multiple modern web technologies integrate together.

I gained hands-on experience with:
- **WebRTC** for P2P video/audio communication
- **WebSockets** for real-time signaling & collaboration
- **mediasoup** for scalable SFU group calls
- **PostgreSQL & Prisma** for relational data modeling
- **Web Crypto API** for client-side encryption
- **Canvas & MediaRecorder** for zero-server recording
- **Google Gemini 2.0 Flash** for AI NLP intelligence
- **Docker** for containerization

Before this project, I mainly worked with standard CRUD web applications. Building OneStudios gave me a deep, end-to-end understanding of real-time systems."

---

## 15. Closing

"So, that is my project, **OneStudios**.
Thank you for your time. I’d be happy to answer any questions or demonstrate any part of the application!"

---

## ❓ Critical Q&A Quick Reference

1. **Q: Why WebSockets for signaling instead of HTTP?**  
   - *A:* WebSockets maintain a persistent 2-way TCP connection, allowing the server to push SDP offers/answers and ICE candidates instantly without polling.

2. **Q: How does mediasoup differ from Socket.io?**  
   - *A:* Socket.io is a WebSocket library for text/JSON data. `mediasoup` is a C++ SFU media server that handles binary RTP/RTCP video and audio packet routing across separate system threads.
&
3. **Q: How does local recording avoid crashing the browser?**  
   - *A:* We draw video elements onto an HTML5 `<canvas>` using requestAnimationFrame, mix audio using `AudioContext`, and stream directly into `MediaRecorder` which encodes WebM using the browser's hardware-accelerated media codecs.