import React, { useEffect, useState } from "react";
import io from "socket.io-client";

const socket = io("http://localhost:3000");

const ChatApp: React.FC = () => {
  const [userCode, setUserCode] = useState<string>("Loading...");
  const [users, setUsers] = useState<string[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [input, setInput] = useState<string>("");

  useEffect(() => {
    socket.on("your code", (code: string) => {
      setUserCode(code);
    });

    socket.on("users update", (userList: string[]) => {
      setUsers(userList);
    });

    socket.on("chat message", (msg: string) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.off("your code");
      socket.off("users update");
      socket.off("chat message");
    };
  }, []);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      socket.emit("chat message", `${userCode}: ${input}`);
      setInput("");
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white p-4 rounded shadow">
        <h1 className="text-2xl font-bold">Campus Chat App</h1>
        <p className="text-gray-600">Your code: <span className="font-mono text-blue-600">{userCode}</span></p>
      </div>

      <div className="flex gap-4">
        <div className="w-1/4 bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-2">Online Users</h2>
          <ul className="space-y-1">
            {users.filter(u => u !== userCode).map((u) => (
              <li key={u} className="text-sm text-gray-800">{u}</li>
            ))}
          </ul>
        </div>

        <div className="w-3/4 bg-white p-4 rounded shadow flex flex-col">
          <ul className="flex-1 overflow-y-auto space-y-2 mb-4">
            {messages.map((msg, idx) => (
              <li key={idx} className="text-sm bg-gray-100 rounded p-2">{msg}</li>
            ))}
          </ul>
          <form onSubmit={sendMessage} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 border border-gray-300 px-3 py-2 rounded"
              placeholder="Type a message..."
            />
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatApp;
