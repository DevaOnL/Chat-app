import React, { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

interface Message {
  text: string;
  sender: "me" | "them";
}

const ChatApp: React.FC = () => {
  const socketRef = useRef<Socket | null>(null);

  const [myCode, setMyCode] = useState<string>("loading");
  const [users, setUsers] = useState<string[]>([]);
  const [threads, setThreads] = useState<Record<string, Message[]>>({ public: [] });
  const [selectedThread, setSelectedThread] = useState<string>("public");
  const [input, setInput] = useState<string>("");

  const addMessage = (thread: string, message: Message) => {
    setThreads(prev => {
      const copy = { ...prev };
      if (!copy[thread]) copy[thread] = [];
      copy[thread].push(message);
      return copy;
    });
  };

  const scrollBottom = () => {
    const el = document.getElementById("messages");
    if (el) el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on("your code", (code: string) => {
      setMyCode(code);
    });

    socket.on("users update", (codes: string[]) => {
      setUsers(codes.filter(c => c !== socket.id));
    });

    socket.on("chat message", (msg: string) => {
      const [senderCode, ...rest] = msg.split(": ");
      const text = rest.join(": ");
      if (senderCode === myCode) return;
      addMessage("public", { text, sender: "them" });
    });

    socket.on("private message", ({ from, message }) => {
      addMessage(from, { text: message, sender: "them" });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(scrollBottom, [threads, selectedThread]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const socket = socketRef.current;
    if (!socket) return;

    if (selectedThread === "public") {
      socket.emit("chat message", `${myCode}: ${input}`);
      addMessage("public", { text: input, sender: "me" });
    } else {
      socket.emit("private message", { toCode: selectedThread, message: input });
      addMessage(selectedThread, { text: input, sender: "me" });
    }

    setInput("");
  };

  const renderUserItem = (code: string) => (
    <li
      key={code}
      className={`px-4 py-2 cursor-pointer hover:bg-blue-100 ${
        selectedThread === code ? "bg-blue-200" : ""
      }`}
      onClick={() => setSelectedThread(code)}
    >
      {code}
    </li>
  );

  const messages = threads[selectedThread] ?? [];

  return (
    <>
      <aside className="w-64 bg-panel border-r border-gray-300 overflow-y-auto">
        <h2 className="p-4 font-semibold border-b border-gray-300">Users</h2>
        <ul className="divide-y divide-gray-200">
          <li
            className={`px-4 py-2 cursor-pointer hover:bg-blue-100 font-semibold ${
              selectedThread === "public" ? "bg-blue-200" : ""
            }`}
            onClick={() => setSelectedThread("public")}
          >
            Public Chat
          </li>
          {users.map(renderUserItem)}
        </ul>
      </aside>

      <section className="flex-1 flex flex-col">
        <div
          id="chatHeader"
          className="px-4 py-2 text-lg font-semibold text-gray-700 border-b border-gray-200"
        >
          {selectedThread === "public" ? "Public Chat" : `Chat with ${selectedThread}`}
        </div>

        <ul
          id="messages"
          className="flex-1 overflow-y-auto p-4 space-y-2 bg-panel flex flex-col w-full"
        >
          {messages.map((m, idx) => (
            <li
              key={idx}
              className={`rounded px-4 py-2 max-w-[70%] break-words ${
                m.sender === "me"
                  ? "bg-blue-500 text-white self-end text-right"
                  : "bg-panel-alt text-fg self-start text-left"
              }`}
            >
              {m.text}
            </li>
          ))}
        </ul>

        <form onSubmit={handleSend} className="p-4 bg-gray-50 flex space-x-3 items-center">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type your message…"
            autoComplete="off"
            className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Send
          </button>
        </form>
      </section>
    </>
  );
};

export default ChatApp;