import React, { useState } from 'react';
import { Footer } from './Footer';
import { Coffee, ArrowRight, User as UserIcon, AlertCircle, Phone, MapPin, Calendar, Loader2, Globe, Sparkles, Tag, Star, CheckCircle2 } from 'lucide-react';
import { loginUser, registerUser } from '../services/storage';
import { User } from '../types';
import { getBrandConfig } from '../services/branding';

interface AuthViewProps {
  onLogin: (user: User | null, isAdmin: boolean) => void;
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

// ── First-Stamp Welcome Popup ──────────────────────────────────────────────
const FirstStampPopup: React.FC<{ user: User; onClose: () => void }> = ({ user, onClose }) => {
  const brandConfig = getBrandConfig();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-500">
      {/* Blurred backdrop */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-700/90 via-brand-600/90 to-brand-800/90 backdrop-blur-sm" />

      {/* Floating decorative blobs */}
      <div className="absolute top-10 left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse delay-700" />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-90 slide-in-from-bottom-6 duration-700">
        {/* Top ribbon */}
        <div className="relative bg-gradient-to-br from-brand-600 via-brand-500 to-brand-700 p-8 text-center overflow-hidden">
          <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />

          {/* Sparkle ring */}
          <div className="relative flex items-center justify-center mb-4">
            <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur flex items-center justify-center ring-4 ring-white/30 shadow-2xl">
              <Star size={44} className="text-yellow-300 fill-yellow-300 drop-shadow-lg" />
            </div>
            {/* Orbiting dots */}
            <div className="absolute w-2.5 h-2.5 bg-yellow-300 rounded-full top-0 left-1/2 -translate-x-1/2 -translate-y-1 animate-bounce" />
            <div className="absolute w-2 h-2 bg-white/70 rounded-full top-3 right-4 animate-bounce delay-300" />
            <div className="absolute w-2 h-2 bg-white/70 rounded-full top-3 left-4 animate-bounce delay-500" />
          </div>

          <h2 className="text-2xl font-black text-white tracking-tight drop-shadow">Welcome aboard! 🎉</h2>
          <p className="mt-1 text-white/85 font-semibold text-sm">
            Hi <span className="font-black">{user.name.split(' ')[0]}</span>, you're now a {brandConfig.name} member!
          </p>
        </div>

        {/* Body */}
        <div className="p-7 space-y-5">
          {/* Instruction card */}
          <div className="rounded-2xl border-2 border-brand-100 bg-brand-50 p-5 flex gap-4 items-start">
            <div className="shrink-0 w-11 h-11 rounded-xl bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/30">
              <Coffee size={22} className="text-white" />
            </div>
            <div>
              <p className="font-black text-gray-900 text-sm leading-snug">Get your first stamp now!</p>
              <p className="text-gray-500 text-xs mt-1 leading-relaxed">
                Show this screen to the cashier and ask them to stamp your new loyalty card.
              </p>
            </div>
          </div>

          {/* Step badges */}
          <div className="space-y-2.5">
            {[
              { step: '1', text: 'Show this screen to the cashier' },
              { step: '2', text: 'Ask them to scan / add your first stamp' },
              { step: '3', text: 'Enjoy collecting more stamps!' },
            ].map(({ step, text }) => (
              <div key={step} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-brand-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                  {step}
                </div>
                <p className="text-gray-700 font-semibold text-sm">{text}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            id="first-stamp-popup-close"
            onClick={onClose}
            className="w-full bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white font-black text-base py-4 rounded-xl shadow-xl shadow-brand-500/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] group relative overflow-hidden mt-2"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            <CheckCircle2 size={20} className="relative" />
            <span className="relative">Got it! Take me to my card</span>
          </button>
        </div>
      </div>
    </div>
  );
};
// ───────────────────────────────────────────────────────────────────────────

export const AuthView: React.FC<AuthViewProps> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [pendingNewUser, setPendingNewUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const brandConfig = getBrandConfig();

  // Shared fields
  const [countryCode, setCountryCode] = useState('62');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');

  // Registration fields
  const [name, setName] = useState('');
  const [address, setAddress] = useState('Kelapa Gading');
  const [adminReferral, setAdminReferral] = useState('');

  // Handle phone number input - only allow digits, no leading 0
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    value = value.replace(/\D/g, '');
    value = value.replace(/^0+/, '');
    const maxLength = 12;
    if (value.length > maxLength) {
      value = value.substring(0, maxLength);
    }
    setPhone(value);
  };

  // Handle birth date input - format as dd/mm/yyyy
  const handleBirthDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    value = value.replace(/\D/g, '');
    if (value.length >= 2) {
      value = value.substring(0, 2) + '/' + value.substring(2);
    }
    if (value.length >= 5) {
      value = value.substring(0, 5) + '/' + value.substring(5, 9);
    }
    setBirthDate(value);
  };

  // Convert dd/mm/yyyy to yyyy-mm-dd for backend
  const convertDateFormat = (ddmmyyyy: string): string => {
    if (ddmmyyyy.length !== 10) return ddmmyyyy;
    const [day, month, year] = ddmmyyyy.split('/');
    return `${year}-${month}-${day}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isRegistering) {
        if (!name || !phone || !address || !birthDate) {
          setError('Please fill in all required fields.');
          setIsLoading(false);
          return;
        }

        if (phone.length < 8) {
          setError('Please enter a valid phone number.');
          setIsLoading(false);
          return;
        }

        if (birthDate.length !== 10) {
          setError('Please enter a valid birth date in DD/MM/YYYY format.');
          setIsLoading(false);
          return;
        }

        const fullPhone = countryCode + phone;
        const formattedBirthDate = convertDateFormat(birthDate);

        const newUser = await registerUser({
          name,
          email: '',
          phone: fullPhone,
          address,
          birthDate: formattedBirthDate,
          adminReferral
        });
        // Show first-stamp popup instead of going straight to member view
        setPendingNewUser(newUser);
      } else {
        const fullPhone = countryCode + phone;

        if (!fullPhone || !birthDate) {
          setError('Please enter both phone number and birth date.');
          setIsLoading(false);
          return;
        }

        const formattedBirthDate = convertDateFormat(birthDate);
        const user = await loginUser(fullPhone, formattedBirthDate);
        if (user) {
          onLogin(user, false);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Check connection.');
    } finally {
      setIsLoading(false);
    }
  };

  // When the new-user popup is dismissed, proceed to member view
  if (pendingNewUser) {
    return (
      <FirstStampPopup
        user={pendingNewUser}
        onClose={() => {
          onLogin(pendingNewUser, false);
          setPendingNewUser(null);
        }}
      />
    );
  }

  return (
    <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-700 ring-1 ring-black/5 my-8 backdrop-blur-xl">
      {/* Header with gradient */}
      <div className="relative p-8 text-center overflow-hidden bg-gradient-to-br from-brand-600 via-brand-500 to-brand-700">
        {/* Animated background elements */}
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-brand-400/20 rounded-full blur-3xl" />

        <div className="relative z-10">
          {brandConfig.logoUrl ? (
            <div className="mb-4 flex justify-center relative z-20">
              <div className="bg-white p-3 rounded-2xl shadow-xl shadow-black/10 transform hover:scale-105 transition-transform duration-300">
                <img src={brandConfig.logoUrl} alt={brandConfig.name} className="h-16 object-contain" />
              </div>
            </div>
          ) : (
            <div className="w-20 h-20 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl ring-1 ring-white/30 transform hover:scale-110 transition-transform duration-300">
              <Coffee size={40} className="text-white drop-shadow-lg" />
            </div>
          )}
          <h1 className="text-4xl font-black text-white mb-2 tracking-tight drop-shadow-lg">{brandConfig.name}</h1>
          <p className="text-white/90 font-bold opacity-90 uppercase tracking-widest text-xs flex items-center justify-center gap-2">
            <Sparkles size={12} />
            {isRegistering ? 'New Member Enrollment' : brandConfig.tagline}
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

          {!isRegistering ? (
            // Login Form
            <>
              {/* Phone Number with Country Code Input */}
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-gray-900 tracking-tight">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative group w-28">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-brand-500 transition-colors">
                      <Globe size={18} />
                    </div>
                    <input
                      type="text"
                      value={countryCode}
                      onChange={(e) => {
                        let value = e.target.value;
                        value = value.replace(/\D/g, '');
                        setCountryCode(value);
                      }}
                      placeholder="62"
                      className="w-full pl-10 pr-2 py-3.5 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none transition-all font-bold text-center hover:border-gray-300"
                    />
                  </div>

                  <div className="relative flex-1 group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-brand-500 transition-colors">
                      <Phone size={18} />
                    </div>
                    <input
                      type="tel"
                      value={phone}
                      onChange={handlePhoneChange}
                      required
                      placeholder="8123456789"
                      className="w-full pl-10 pr-4 py-3.5 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none transition-all font-medium hover:border-gray-300"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                  <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                  Enter country code and phone number separately
                </p>
              </div>

              {/* Birth Date Input */}
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-gray-900 tracking-tight">
                  Birth Date <span className="text-red-500">*</span>
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-brand-500 transition-colors">
                    <Calendar size={18} />
                  </div>
                  <input
                    type="text"
                    value={birthDate}
                    onChange={handleBirthDateChange}
                    required
                    placeholder="DD/MM/YYYY"
                    maxLength={10}
                    className="w-full pl-10 pr-4 py-3.5 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none transition-all font-medium hover:border-gray-300"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                  <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                  Example: 20/12/2003
                </p>
              </div>
            </>
          ) : (
            // Registration Form
            <div className="space-y-5 animate-in slide-in-from-right-4 fade-in duration-500">
              <InputField
                label="Full Name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                icon={UserIcon}
                required
              />


              {/* Phone Number with Country Code Input */}
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-gray-900 tracking-tight">
                  Mobile Phone <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative group w-28">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-brand-500 transition-colors">
                      <Globe size={18} />
                    </div>
                    <input
                      type="text"
                      value={countryCode}
                      onChange={(e) => {
                        let value = e.target.value;
                        value = value.replace(/\D/g, '');
                        setCountryCode(value);
                      }}
                      placeholder="62"
                      className="w-full pl-10 pr-2 py-3.5 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none transition-all font-bold text-center hover:border-gray-300"
                    />
                  </div>
                  <div className="relative flex-1 group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-brand-500 transition-colors">
                      <Phone size={18} />
                    </div>
                    <input
                      type="tel"
                      value={phone}
                      onChange={handlePhoneChange}
                      required
                      placeholder="8123456789"
                      className="w-full pl-10 pr-4 py-3.5 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none transition-all font-medium hover:border-gray-300"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                  <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                  Enter digits only, no leading 0
                </p>
              </div>

              {/* Domicile Dropdown */}
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-gray-900 tracking-tight">Domicile <span className="text-red-500">*</span></label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-brand-500 transition-colors">
                    <MapPin size={18} />
                  </div>
                  <select
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-3.5 rounded-xl border-2 border-gray-200 bg-white text-gray-900 focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none transition-all font-medium hover:border-gray-300 appearance-none cursor-pointer"
                  >
                    <option value="Kelapa Gading">Kelapa Gading</option>
                    <option value="Luar Kelapa Gading">Luar Kelapa Gading</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>

              {/* Birth Date Input */}
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-gray-900 tracking-tight">
                  Birth Date <span className="text-red-500">*</span>
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-brand-500 transition-colors">
                    <Calendar size={18} />
                  </div>
                  <input
                    type="text"
                    value={birthDate}
                    onChange={handleBirthDateChange}
                    required
                    placeholder="DD/MM/YYYY"
                    maxLength={10}
                    className="w-full pl-10 pr-4 py-3.5 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none transition-all font-medium hover:border-gray-300"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                  <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                  Example: 12/05/1998
                </p>
              </div>

              {/* Game Master Referral Input (Optional) */}
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-gray-900 tracking-tight">
                  Staff Referral
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-brand-500 transition-colors">
                    <Tag size={18} />
                  </div>
                  <input
                    type="text"
                    value={adminReferral}
                    onChange={(e) => setAdminReferral(e.target.value)}
                    placeholder="Enter staff name (Optional)"
                    className="w-full pl-10 pr-4 py-3.5 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none transition-all font-medium hover:border-gray-300"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                  <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                  Ask your staff for this (leave blank if none)
                </p>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white font-black text-lg py-4 px-6 rounded-xl shadow-xl shadow-brand-500/30 flex items-center justify-center gap-3 transition-all active:scale-[0.98] mt-6 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
            {isLoading ? (
              <Loader2 className="animate-spin" size={24} />
            ) : (
              <>
                <span className="relative">{isRegistering ? 'Create Profile' : 'Sign In'}</span>
                <ArrowRight size={22} className="relative group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError('');
              setPhone('');
              setCountryCode('62');
              setBirthDate('');
              setName('');
              setAddress('Kelapa Gading');
              setAdminReferral('');
            }}
            className="text-sm font-black text-brand-600 hover:text-brand-700 flex items-center justify-center gap-2 mx-auto py-2 px-6 rounded-xl hover:bg-brand-50 transition-all uppercase tracking-wider group"
          >
            <span className="group-hover:scale-110 transition-transform inline-block">
              {isRegistering ? '←' : '→'}
            </span>
            {isRegistering ? 'Have an account? Login' : 'New here? Register now'}
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100/50">
          <Footer />
        </div>
      </div>
    </div>
  );
};