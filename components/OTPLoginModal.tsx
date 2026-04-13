'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase/client';

interface OTPLoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (userId: string) => void;
    onGuestCheckout?: () => void;
}

type Step = 'phone' | 'otp';

export function OTPLoginModal({ isOpen, onClose, onSuccess, onGuestCheckout }: OTPLoginModalProps) {
    const [step, setStep] = useState<Step>('phone');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [canResend, setCanResend] = useState(false);
    const [resendCountdown, setResendCountdown] = useState(30);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setStep('phone');
            setPhoneNumber('');
            setOtp('');
            setError('');
            setCanResend(false);
            setResendCountdown(30);
        }
    }, [isOpen]);

    // Resend countdown timer
    useEffect(() => {
        if (step === 'otp' && resendCountdown > 0) {
            const timer = setTimeout(() => {
                setResendCountdown(resendCountdown - 1);
            }, 1000);
            return () => clearTimeout(timer);
        } else if (resendCountdown === 0) {
            setCanResend(true);
        }
    }, [step, resendCountdown]);

    const validatePhoneNumber = (phone: string): boolean => {
        // Remove any non-digit characters
        const cleaned = phone.replace(/\D/g, '');
        return cleaned.length === 10;
    };

    const formatPhoneNumber = (value: string): string => {
        // Remove all non-digits
        const cleaned = value.replace(/\D/g, '');
        // Limit to 10 digits
        return cleaned.slice(0, 10);
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatPhoneNumber(e.target.value);
        setPhoneNumber(formatted);
        setError('');
    };

    const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
        setOtp(value);
        setError('');
    };

    const handleSendOTP = async () => {
        if (!validatePhoneNumber(phoneNumber)) {
            setError('Please enter a valid 10-digit mobile number');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const { error: otpError } = await supabase.auth.signInWithOtp({
                phone: `+91${phoneNumber}`,
            });

            if (otpError) throw otpError;

            setStep('otp');
            setResendCountdown(30);
            setCanResend(false);
        } catch (err: any) {
            console.error('OTP send error:', err);
            if (err.message?.includes('SMS') || err.message?.includes('provider')) {
                setError('SMS service not configured. Please contact support.');
            } else {
                setError(err.message || 'Failed to send OTP. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (otp.length !== 6) {
            setError('Please enter a valid 6-digit OTP');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const { data, error: verifyError } = await supabase.auth.verifyOtp({
                phone: `+91${phoneNumber}`,
                token: otp,
                type: 'sms',
            });

            if (verifyError) throw verifyError;

            if (!data.user) {
                throw new Error('Authentication failed');
            }

            // Success!
            onSuccess(data.user.id);
        } catch (err: any) {
            console.error('OTP verification error:', err);
            setError(err.message || 'Invalid OTP. Please try again.');
            setOtp(''); // Clear OTP on error
        } finally {
            setLoading(false);
        }
    };

    const handleResendOTP = () => {
        setOtp('');
        setError('');
        handleSendOTP();
    };

    const handleBack = () => {
        setStep('phone');
        setOtp('');
        setError('');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full rounded-t-3xl md:rounded-2xl bg-card shadow-2xl md:max-w-md overflow-hidden">
                {/* Header */}
                <div className="relative flex items-center justify-between border-b border-border bg-card p-6">
                    {step === 'otp' && (
                        <button
                            onClick={handleBack}
                            className="absolute left-4 rounded-lg p-2 hover:bg-secondary transition-colors"
                            disabled={loading}
                        >
                            <ArrowLeft size={20} className="text-foreground" />
                        </button>
                    )}
                    <h2 className="text-2xl font-bold text-foreground flex-1 text-center">
                        {step === 'phone' ? 'Phone Verification' : 'Enter OTP'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 hover:bg-secondary transition-colors"
                        disabled={loading}
                    >
                        <X size={24} className="text-foreground" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Description */}
                    <p className="text-sm text-muted-foreground text-center">
                        {step === 'phone'
                            ? 'We\'ll send you a verification code to confirm your order'
                            : `Code sent to +91 ${phoneNumber.slice(0, 5)}-${phoneNumber.slice(5)}`}
                    </p>

                    {/* Error Message */}
                    {error && (
                        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive text-center">
                            {error}
                        </div>
                    )}

                    {/* Input Section */}
                    {step === 'phone' ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-foreground mb-2">
                                    Mobile Number
                                </label>
                                <div className="flex gap-3">
                                    <div className="flex items-center justify-center px-4 bg-secondary rounded-lg border border-input font-semibold text-foreground">
                                        +91
                                    </div>
                                    <input
                                        type="tel"
                                        value={phoneNumber}
                                        onChange={handlePhoneChange}
                                        placeholder="98765 43210"
                                        className="flex-1 rounded-lg border border-input bg-background px-4 py-3 text-lg ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        disabled={loading}
                                        autoFocus
                                        maxLength={10}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleSendOTP}
                                disabled={loading || phoneNumber.length !== 10}
                                className="w-full rounded-lg bg-primary px-6 py-3 font-bold text-primary-foreground transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="inline mr-2 h-5 w-5 animate-spin" />
                                        Sending OTP...
                                    </>
                                ) : (
                                    'Send OTP'
                                )}
                            </button>

                            {onGuestCheckout && (
                                <div className="mt-4 text-center">
                                    <span className="text-sm text-muted-foreground mr-2">Don't want to register?</span>
                                    <button
                                        onClick={onGuestCheckout}
                                        className="text-sm font-bold text-primary hover:underline"
                                    >
                                        Continue as Guest
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-foreground mb-2">
                                    Verification Code
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={otp}
                                    onChange={handleOtpChange}
                                    placeholder="000000"
                                    className="w-full rounded-lg border border-input bg-background px-4 py-3 text-center text-2xl font-bold tracking-widest ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={loading}
                                    autoFocus
                                    maxLength={6}
                                />
                            </div>

                            <button
                                onClick={handleVerifyOTP}
                                disabled={loading || otp.length !== 6}
                                className="w-full rounded-lg bg-primary px-6 py-3 font-bold text-primary-foreground transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="inline mr-2 h-5 w-5 animate-spin" />
                                        Verifying...
                                    </>
                                ) : (
                                    'Verify & Continue'
                                )}
                            </button>

                            {/* Resend OTP */}
                            <div className="text-center">
                                {canResend ? (
                                    <button
                                        onClick={handleResendOTP}
                                        disabled={loading}
                                        className="text-sm font-semibold text-primary hover:underline disabled:opacity-50"
                                    >
                                        Resend OTP
                                    </button>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        Resend OTP in {resendCountdown}s
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Security Note */}
                    <div className="pt-4 border-t border-border">
                        <p className="text-xs text-muted-foreground text-center">
                            🔒 Your phone number is encrypted and never shared with third parties
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
