import React, { useState } from 'react';
import { Footer } from './Footer';
import { Shield, ArrowRight, Lock, User as UserIcon, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { setAdminSession } from '../services/storage';
import { getBrandConfig } from '../services/branding';

interface AdminLoginProps {
    onLogin: () => void;
}

const InputField = ({
    label, type, value, onChange, placeholder, icon: Icon, required = false
}: {
    label: string, type: string, value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, placeholder: string, icon: React.ElementType, required?: boolean
}) => (
    <div className="space-y-1.5">
        <label className="block text-sm font-bold text-gray-900 tracking-tight">{label} {required && <span className="text-red-500">*</span>}</label>
        <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-brand-500 transition-colors">
                <Icon size={18} />
            </div>
            <input
                type={type}
                value={value}
                onChange={onChange}
                required={required}
                className="w-full pl-10 pr-4 py-3.5 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none transition-all font-medium hover:border-gray-300"
                placeholder={placeholder}
            />
        </div>
    </div>
);

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const brandConfig = getBrandConfig();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            if (username === 'admin' && password === 'admin123') {
                setAdminSession();
                onLogin();
            } else {
                setError('Invalid username or password.');
            }
        } catch (err: any) {
            setError('Login failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-700 ring-1 ring-black/5 my-8">
            {/* Header with gradient */}
            <div className="relative p-8 text-center overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
                {/* Animated background elements */}
                <div className="absolute top-0 right-1/4 w-72 h-72 bg-brand-500/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-brand-600/10 rounded-full blur-3xl" />

                <div className="relative z-10">
                    <div className="w-20 h-20 bg-gradient-to-br from-brand-500 to-brand-600 backdrop-blur-xl rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl ring-4 ring-white/10 transform hover:scale-110 transition-transform duration-300">
                        <Shield size={40} className="text-white drop-shadow-lg" />
                    </div>
                    <h1 className="text-4xl font-black text-white mb-2 tracking-tight drop-shadow-lg">{brandConfig.name}</h1>
                    <p className="text-white/80 font-bold opacity-90 uppercase tracking-widest text-xs flex items-center justify-center gap-2">
                        <Sparkles size={12} />
                        Admin Access Portal
                    </p>
                </div>
            </div>

            <div className="p-8 bg-gradient-to-b from-white to-gray-50">
                <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                        <div className="p-4 bg-red-50 text-red-600 text-sm font-bold rounded-xl border-2 border-red-100 flex items-center gap-3 animate-in slide-in-from-top-2">
                            <AlertCircle size={18} className="shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <InputField
                        label="Username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="admin"
                        icon={UserIcon}
                        required
                    />

                    <InputField
                        label="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        icon={Lock}
                        required
                    />

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-gradient-to-r from-gray-900 to-gray-800 hover:from-black hover:to-gray-900 text-white font-black text-lg py-4 px-6 rounded-xl shadow-xl shadow-gray-900/30 flex items-center justify-center gap-3 transition-all active:scale-[0.98] mt-6 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                        {isLoading ? (
                            <Loader2 className="animate-spin" size={24} />
                        ) : (
                            <>
                                <Shield size={20} className="relative" />
                                <span className="relative">Sign In as Admin</span>
                                <ArrowRight size={22} className="relative group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-gray-200 text-center">
                    <a
                        href="/"
                        className="text-sm font-black text-gray-500 hover:text-gray-700 uppercase tracking-widest inline-flex items-center gap-2 hover:gap-3 transition-all"
                    >
                        <span>←</span>
                        Back to Member Login
                    </a>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100/50">
                    <Footer />
                </div>
            </div>
        </div>
    );
};
