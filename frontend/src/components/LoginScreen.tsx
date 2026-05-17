import React, { useState } from 'react';

interface LoginScreenProps {
    onJoin: (name: string) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onJoin }) => {
    const [name, setName] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onJoin(name.trim());
        }
    };

    return (
        <div className="w-full h-screen bg-slate-900 flex items-center justify-center text-white p-4">
            <div className="bg-slate-800 p-8 rounded-xl shadow-2xl max-w-md w-full border border-slate-700">
                <h1 className="text-4xl font-bold mb-6 text-center text-emerald-400 font-serif">Court Piece</h1>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-300">Enter your name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                            placeholder="e.g. Player 1"
                            maxLength={15}
                            autoFocus
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={!name.trim()}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-lg mt-2"
                    >
                        Join Game
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginScreen;
