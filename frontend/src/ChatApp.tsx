import React, { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

interface Message {
  text: string;
  sender: "me" | "them";
}
interface Props {
  onCode: (c: string) => void;
}

const ChatApp: React.FC<Props> = ({ onCode }) => {
  const socketRef = useRef<Socket | null>(null);
  const myCodeRef = useRef<string>("");

  /* ──────────────────────────────── state */
  const [myCode, setMyCode]   = useState("loading");
  const [users, setUsers]     = useState<string[]>([]);
  const [threads, setThreads] = useState<Record<string, Message[]>>({ public: [] });
  const [selected, setSelected] = useState("public");
  const [input, setInput]     = useState("");

  /* ──────────────────────────────── helpers */
  const addMsg = (thread: string, msg: Message) =>
    setThreads(p => ({ ...p, [thread]: [...(p[thread] || []), msg] }));

  /* ──────────────────────────────── socket lifecycle */
  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on("your code", (code: string) => {
      myCodeRef.current = code;
      setMyCode(code);
      onCode(code);
    });

    socket.on("users update", (codes: string[]) => {
      // Ignore until we actually know our own code
      if (!myCodeRef.current) return;
      setUsers(codes.filter(c => c !== myCodeRef.current));
    });

    socket.on("chat message", (raw: string) => {
      const [sender, ...rest] = raw.split(": ");
      if (sender === myCodeRef.current) return;      // ignore own echo
      addMsg("public", { text: rest.join(": "), sender: "them" });
    });

    socket.on("private message", ({ from, message }) => {
      addMsg(from, { text: message, sender: "them" });
    });

    return () => { socket.disconnect(); };
  }, []);

  /* auto-scroll */
  useEffect(() => {
    const el = document.getElementById("messages");
    if (el) el.scrollTop = el.scrollHeight;
  }, [threads, selected]);

  /* ──────────────────────────────── send */
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const s = socketRef.current;
    if (!s) return;

    if (selected === "public") {
      s.emit("chat message", `${myCodeRef.current}: ${input}`);
      addMsg("public", { text: input, sender: "me" });
    } else if (selected !== myCodeRef.current) {
      s.emit("private message", { toCode: selected, message: input });
      addMsg(selected, { text: input, sender: "me" });
    }
    setInput("");
  };

  /* ──────────────────────────────── render */
  const msgs = threads[selected] || [];

  return (
    <>
      {/* sidebar */}
      <aside className="w-64 bg-panel border-r border-border overflow-y-auto">
        <h2 className="p-4 font-semibold border-b border-border">Users</h2>
        <ul>
          <li
            className={`px-4 py-2 cursor-pointer hover:bg-panelAlt font-semibold ${
              selected === "public" && "bg-panelAlt"
            }`}
            onClick={() => setSelected("public")}
          >
            Public Chat
          </li>
          {users.map(code => (
            <li
              key={code}
              className={`px-4 py-2 cursor-pointer hover:bg-panelAlt ${
                selected === code && "bg-panelAlt"
              }`}
              onClick={() => setSelected(code)}
            >
              {code}
            </li>
          ))}
        </ul>
      </aside>

      {/* chat area */}
      <section className="flex-1 flex flex-col">
        <div className="px-4 py-2 bg-header border-b border-border text-fg font-semibold">
          {selected === "public" ? "Public Chat" : `Chat with ${selected}`}
        </div>

        <ul
          id="messages"
          className="flex-1 overflow-y-auto p-4 space-y-2 bg-panel flex flex-col"
        >
          {msgs.map((m, i) => (
            <li
              key={i}
              className={`rounded px-4 py-2 max-w-[70%] break-words ${
                m.sender === "me"
                  ? "bg-accent text-accentFore self-end text-right"
                  : "bg-panelAlt text-fg self-start border border-border"
              }`}
            >
              {m.text}
            </li>
          ))}
        </ul>

        <form onSubmit={send} className="p-4 bg-panel border-t border-border flex gap-3">
          <input
            className="flex-1 border border-border rounded px-3 py-2 bg-panelAlt text-fg placeholder:text-fg/60"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type your message…"
          />
          <button className="bg-accent text-accentFore px-4 py-2 rounded">Send</button>
        </form>
      </section>
    </>
  );
};

export default ChatApp;