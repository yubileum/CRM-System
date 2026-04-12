import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Award, Hash, Users, UserPlus, Tag } from 'lucide-react';
import { StampConfig, StampCheckpoint, AdminEntry } from '../types';
import { getStampConfig, saveStampConfig } from '../services/stampConfig';
import { fetchAdminList, saveAdminList } from '../services/adminConfig';

interface StampConfigModalProps {
    onClose: () => void;
}

export const StampConfigModal: React.FC<StampConfigModalProps> = ({ onClose }) => {
    const [config, setConfig] = useState<StampConfig>(getStampConfig());
    const [maxStamps, setMaxStamps] = useState(config.maxStamps.toString());
    const [checkpoints, setCheckpoints] = useState<StampCheckpoint[]>(config.checkpoints);
    const [newCheckpointStamp, setNewCheckpointStamp] = useState('');
    const [newCheckpointReward, setNewCheckpointReward] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Admin List state
    const [admins, setAdmins] = useState<AdminEntry[]>([]);
    const [isLoadingAdmins, setIsLoadingAdmins] = useState(true);
    const [newAdminName, setNewAdminName] = useState('');
    const [newAdminCode, setNewAdminCode] = useState('');

    useEffect(() => {
        fetchAdminList().then(list => {
            setAdmins(list);
            setIsLoadingAdmins(false);
        });
    }, []);

    const handleAddCheckpoint = () => {
        const stampCount = parseInt(newCheckpointStamp);
        if (!stampCount || stampCount <= 0 || !newCheckpointReward.trim()) {
            return;
        }

        if (checkpoints.some(cp => cp.stampCount === stampCount)) {
            alert('A checkpoint already exists for this stamp count');
            return;
        }

        const newCheckpoints = [...checkpoints, { stampCount, reward: newCheckpointReward.trim() }];
        newCheckpoints.sort((a, b) => a.stampCount - b.stampCount);
        setCheckpoints(newCheckpoints);
        setNewCheckpointStamp('');
        setNewCheckpointReward('');
    };

    const handleRemoveCheckpoint = (stampCount: number) => {
        setCheckpoints(checkpoints.filter(cp => cp.stampCount !== stampCount));
    };

    const handleAddAdmin = () => {
        const trimmedName = newAdminName.trim();
        const trimmedCode = newAdminCode.trim() || trimmedName; // default to name if empty
        if (!trimmedName) return;

        if (admins.some(a => a.code.toLowerCase() === trimmedCode.toLowerCase())) {
            alert('An admin with this code already exists.');
            return;
        }

        const newAdmin: AdminEntry = {
            id: 'admin-' + Date.now(),
            name: trimmedName,
            code: trimmedCode
        };
        setAdmins([...admins, newAdmin]);
        setNewAdminName('');
        setNewAdminCode('');
    };

    const handleRemoveAdmin = (id: string) => {
        setAdmins(admins.filter(a => a.id !== id));
    };

    const handleSave = async () => {
        const maxStampsNum = parseInt(maxStamps);
        if (!maxStampsNum || maxStampsNum <= 0) {
            alert('Please enter a valid maximum stamps number');
            return;
        }

        const invalidCheckpoints = checkpoints.filter(cp => cp.stampCount > maxStampsNum);
        if (invalidCheckpoints.length > 0) {
            alert(`Some checkpoints exceed the maximum stamps (${maxStampsNum}). Please adjust.`);
            return;
        }

        const newConfig: StampConfig = {
            maxStamps: maxStampsNum,
            checkpoints: checkpoints
        };

        setIsSaving(true);
        const [stampSuccess, adminSuccess] = await Promise.all([
            saveStampConfig(newConfig),
            saveAdminList(admins)
        ]);
        setIsSaving(false);

        if (stampSuccess && adminSuccess) {
            alert('Configuration saved successfully to database!');
            onClose();
        } else if (stampSuccess) {
            alert('Stamp config saved, but failed to save admin list. Please try again.');
        } else {
            alert('Failed to save configuration. Please try again.');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="absolute inset-0" onClick={onClose}></div>
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 w-full max-w-2xl rounded-3xl p-8 relative z-10 shadow-2xl border border-gray-700 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"
                >
                    <X size={24} />
                </button>

                <div className="space-y-6">
                    {/* Header */}
                    <div className="text-center">
                        <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
                            <Award size={40} className="text-white" />
                        </div>
                        <h2 className="text-3xl font-black text-white mb-2">Stamp Configuration</h2>
                        <p className="text-gray-400 font-medium">Configure maximum stamps and reward checkpoints</p>
                    </div>

                    {/* Max Stamps */}
                    <div className="bg-gray-700/50 rounded-2xl p-6 border border-gray-600">
                        <label className="block text-sm font-bold text-white mb-3 flex items-center gap-2">
                            <Hash size={18} className="text-purple-400" />
                            Maximum Stamps
                        </label>
                        <input
                            type="number"
                            value={maxStamps}
                            onChange={(e) => setMaxStamps(e.target.value)}
                            min="1"
                            className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-600 bg-gray-700/50 text-white placeholder:text-gray-500 focus:bg-gray-700 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 outline-none transition-all font-bold text-lg"
                            placeholder="10"
                        />
                        <p className="text-xs text-gray-500 mt-2">Total number of stamps needed to complete the card</p>
                    </div>

                    {/* Checkpoints List */}
                    <div className="bg-gray-700/50 rounded-2xl p-6 border border-gray-600">
                        <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                            <Award size={20} className="text-pink-400" />
                            Reward Checkpoints
                        </h3>

                        {checkpoints.length > 0 ? (
                            <div className="space-y-3 mb-4">
                                {checkpoints.map((cp) => (
                                    <div key={cp.stampCount} className="flex items-center gap-3 bg-gray-800/50 p-4 rounded-xl border border-gray-600">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-2xl font-black text-purple-400">{cp.stampCount}</span>
                                                <span className="text-sm font-bold text-gray-400">stamps</span>
                                            </div>
                                            <p className="text-white font-medium">{cp.reward}</p>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveCheckpoint(cp.stampCount)}
                                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-500 text-center py-8 font-medium">No checkpoints configured yet</p>
                        )}

                        {/* Add Checkpoint Form */}
                        <div className="space-y-3 pt-4 border-t border-gray-600">
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-2">Stamp Count</label>
                                    <input
                                        type="number"
                                        value={newCheckpointStamp}
                                        onChange={(e) => setNewCheckpointStamp(e.target.value)}
                                        min="1"
                                        placeholder="5"
                                        className="w-full px-3 py-2.5 rounded-lg border-2 border-gray-600 bg-gray-700/50 text-white placeholder:text-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all font-bold"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-gray-400 mb-2">Reward</label>
                                    <input
                                        type="text"
                                        value={newCheckpointReward}
                                        onChange={(e) => setNewCheckpointReward(e.target.value)}
                                        placeholder="Free iced tea"
                                        className="w-full px-3 py-2.5 rounded-lg border-2 border-gray-600 bg-gray-700/50 text-white placeholder:text-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all font-medium"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={handleAddCheckpoint}
                                disabled={!newCheckpointStamp || !newCheckpointReward.trim()}
                                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg"
                            >
                                <Plus size={20} />
                                Add Checkpoint
                            </button>
                        </div>
                    </div>

                    {/* Admin List */}
                    <div className="bg-gray-700/50 rounded-2xl p-6 border border-gray-600">
                        <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                            <Users size={20} className="text-purple-400" />
                            Admin List
                        </h3>
                        <p className="text-xs text-gray-400 mb-4">These admins will appear as a dropdown option in the member registration form.</p>

                        {isLoadingAdmins ? (
                            <p className="text-gray-500 text-center py-6 font-medium">Loading admin list...</p>
                        ) : admins.length > 0 ? (
                            <div className="space-y-3 mb-4">
                                {admins.map((admin) => (
                                    <div key={admin.id} className="flex items-center gap-3 bg-gray-800/50 p-4 rounded-xl border border-gray-600">
                                        <div className="flex-1">
                                            <p className="text-white font-bold">{admin.name}</p>
                                            <p className="text-purple-400 text-sm font-mono">{admin.code}</p>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveAdmin(admin.id)}
                                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-500 text-center py-6 font-medium">No admins configured yet</p>
                        )}

                        {/* Add Admin Form */}
                        <div className="space-y-3 pt-4 border-t border-gray-600">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-2">Name</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                                            <UserPlus size={14} />
                                        </div>
                                        <input
                                            type="text"
                                            value={newAdminName}
                                            onChange={(e) => setNewAdminName(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddAdmin()}
                                            placeholder="e.g. John"
                                            className="w-full pl-8 pr-3 py-2.5 rounded-lg border-2 border-gray-600 bg-gray-700/50 text-white placeholder:text-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all font-medium"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-2">
                                        Referral Code <span className="text-gray-500 font-normal">(optional)</span>
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                                            <Tag size={14} />
                                        </div>
                                        <input
                                            type="text"
                                            value={newAdminCode}
                                            onChange={(e) => setNewAdminCode(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddAdmin()}
                                            placeholder={newAdminName.trim() || 'defaults to name'}
                                            className="w-full pl-8 pr-3 py-2.5 rounded-lg border-2 border-gray-600 bg-gray-700/50 text-white placeholder:text-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all font-mono"
                                        />
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={handleAddAdmin}
                                disabled={!newAdminName.trim()}
                                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg"
                            >
                                <UserPlus size={20} />
                                Add Admin
                            </button>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4">
                        <button
                            onClick={onClose}
                            className="flex-1 py-4 px-4 rounded-xl font-bold text-gray-400 bg-gray-700/50 hover:bg-gray-700 transition-colors border border-gray-600"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex-1 py-4 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/30 transition-all flex items-center justify-center gap-2"
                        >
                            <Save size={20} />
                            {isSaving ? 'Saving to Database...' : 'Save Configuration'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
