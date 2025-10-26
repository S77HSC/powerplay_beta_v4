// components/VoiceCall.jsx
"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

export default function VoiceCall({ pairKey, userId }) {
  const pcRef = useRef(null);
  const localRef = useRef(null);
  const remoteRef = useRef(null);
  const channelRef = useRef(null);
  const [inCall, setInCall] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const channel = supabase.channel(`call-dm-${pairKey}`);
    channel
      .on("broadcast", { event: "webrtc" }, async ({ payload }) => {
        const pc = pcRef.current;
        if (!pc) return;
        if (payload.type === "offer") {
          await pc.setRemoteDescription(payload.sdp);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          channel.send({ type: "broadcast", event: "webrtc", payload: { type: "answer", sdp: answer, from: userId } });
        } else if (payload.type === "answer") {
          await pc.setRemoteDescription(payload.sdp);
        } else if (payload.type === "ice") {
          try { await pc.addIceCandidate(payload.candidate); } catch {}
        } else if (payload.type === "hangup") {
          endCall();
        }
      })
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [pairKey, userId]);

  const ensurePC = async () => {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    pc.onicecandidate = (e) => {
      if (e.candidate) channelRef.current?.send({
        type: "broadcast", event: "webrtc",
        payload: { type: "ice", candidate: e.candidate, from: userId }
      });
    };
    pc.ontrack = (e) => { if (remoteRef.current) remoteRef.current.srcObject = e.streams[0]; };

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (localRef.current) localRef.current.srcObject = stream;
    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    pcRef.current = pc;
    return pc;
  };

  const startCall = async () => {
    const pc = await ensurePC();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    channelRef.current?.send({ type: "broadcast", event: "webrtc", payload: { type: "offer", sdp: offer, from: userId } });
    setInCall(true);
  };

  const endCall = () => {
    setInCall(false);
    channelRef.current?.send({ type: "broadcast", event: "webrtc", payload: { type: "hangup", from: userId } });
    pcRef.current?.getSenders().forEach(s => s.track && s.track.stop());
    pcRef.current?.close();
    pcRef.current = null;
    if (localRef.current) localRef.current.srcObject = null;
    if (remoteRef.current) remoteRef.current.srcObject = null;
  };

  const toggleMute = () => {
    setMuted((v) => {
      const next = !v;
      const stream = localRef.current?.srcObject;
      stream?.getAudioTracks().forEach((t) => (t.enabled = !next));
      return next;
    });
  };

  return (
    <div className="flex items-center gap-2">
      <audio ref={localRef} autoPlay muted />
      <audio ref={remoteRef} autoPlay />
      {!inCall ? (
        <button onClick={startCall} className="bg-yellow-500 text-black px-3 py-1 rounded-xl text-sm font-semibold">
          Call
        </button>
      ) : (
        <>
          <button onClick={toggleMute} className="bg-gray-700 px-3 py-1 rounded-xl text-sm">
            {muted ? "Unmute" : "Mute"}
          </button>
          <button onClick={endCall} className="bg-red-600 px-3 py-1 rounded-xl text-sm">
            Hang up
          </button>
        </>
      )}
    </div>
  );
}
