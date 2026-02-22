import React, { useState } from 'react';
import { Coffee, ArrowRight, Mail, User as UserIcon, AlertCircle, Phone, MapPin, Calendar, Loader2, Globe, Sparkles, Tag } from 'lucide-react';
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

export const AuthView: React.FC<AuthViewProps> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const brandConfig = getBrandConfig();

  // Shared fields
  const [countryCode, setCountryCode] = useState('62');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');

  // Registration fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
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
        if (!name || !email || !phone || !address || !birthDate || !adminReferral) {
          setError('Please fill in all required fields, including the Admin Referral Code.');
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
          email,
          phone: fullPhone,
          address,
          birthDate: formattedBirthDate,
          adminReferral
        });
        onLogin(newUser, false);
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
              <InputField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="hello@example.com"
                icon={Mail}
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

              <InputField
                label="Domicile"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Kelapa Gading"
                icon={MapPin}
                required
              />

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

              {/* Admin Referral Code Input */}
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-gray-900 tracking-tight">
                  Admin Referral Code <span className="text-red-500">*</span>
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-brand-500 transition-colors">
                    <Tag size={18} />
                  </div>
                  <input
                    type="text"
                    value={adminReferral}
                    onChange={(e) => setAdminReferral(e.target.value)}
                    required
                    placeholder="Enter admin's name"
                    className="w-full pl-10 pr-4 py-3.5 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none transition-all font-medium hover:border-gray-300"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                  <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                  Ask your cashier or admin for this code
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
              setEmail('');
              setAddress('');
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
      </div>
    </div>
  );
};