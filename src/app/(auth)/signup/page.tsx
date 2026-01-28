"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Video,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Check,
  Upload,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Country codes with flags
const countryCodes = [
  { code: "+61", country: "AU", flag: "🇦🇺", name: "Australia" },
  { code: "+1", country: "US", flag: "🇺🇸", name: "United States" },
  { code: "+44", country: "GB", flag: "🇬🇧", name: "United Kingdom" },
  { code: "+64", country: "NZ", flag: "🇳🇿", name: "New Zealand" },
  { code: "+91", country: "IN", flag: "🇮🇳", name: "India" },
  { code: "+81", country: "JP", flag: "🇯🇵", name: "Japan" },
  { code: "+82", country: "KR", flag: "🇰🇷", name: "South Korea" },
  { code: "+86", country: "CN", flag: "🇨🇳", name: "China" },
  { code: "+49", country: "DE", flag: "🇩🇪", name: "Germany" },
  { code: "+33", country: "FR", flag: "🇫🇷", name: "France" },
  { code: "+39", country: "IT", flag: "🇮🇹", name: "Italy" },
  { code: "+34", country: "ES", flag: "🇪🇸", name: "Spain" },
  { code: "+55", country: "BR", flag: "🇧🇷", name: "Brazil" },
  { code: "+52", country: "MX", flag: "🇲🇽", name: "Mexico" },
  { code: "+65", country: "SG", flag: "🇸🇬", name: "Singapore" },
];

const businessSizes = [
  { value: "solo", label: "Just me" },
  { value: "2-10", label: "2-10 employees" },
  { value: "11-50", label: "11-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "200+", label: "200+ employees" },
];

const referralSources = [
  { value: "google", label: "Google Search" },
  { value: "social", label: "Social Media" },
  { value: "friend", label: "Friend or Colleague" },
  { value: "youtube", label: "YouTube" },
  { value: "blog", label: "Blog or Article" },
  { value: "podcast", label: "Podcast" },
  { value: "other", label: "Other" },
];

const videoQualities = [
  { value: "720p", label: "720p HD", description: "Good for web & social" },
  { value: "1080p", label: "1080p Full HD", description: "Recommended for most uses" },
  { value: "4k", label: "4K Ultra HD", description: "Maximum quality" },
];

const TOTAL_STEPS = 5;

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phoneCountryCode: string;
  phoneNumber: string;
  otpCode: string;
  password: string;
  confirmPassword: string;
  businessName: string;
  businessLogoUrl: string;
  businessDescription: string;
  businessSize: string;
  defaultVideoQuality: string;
  referralSource: string;
}

export default function SignUpPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    phoneCountryCode: "+61",
    phoneNumber: "",
    otpCode: "",
    password: "",
    confirmPassword: "",
    businessName: "",
    businessLogoUrl: "",
    businessDescription: "",
    businessSize: "",
    defaultVideoQuality: "1080p",
    referralSource: "",
  });

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const updateFormData = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSendOTP = async () => {
    if (!formData.email) {
      toast.error("Please enter your email");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send verification code");
      }

      setOtpSent(true);
      setResendCooldown(60);
      toast.success("Verification code sent to your email!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!formData.otpCode || formData.otpCode.length !== 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          code: formData.otpCode,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Invalid verification code");
      }

      setOtpVerified(true);
      toast.success("Email verified!");
      setStep(3);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const previewUrl = URL.createObjectURL(file);
      setLogoPreview(previewUrl);
    }
  };

  const handleCreateAccount = async () => {
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (formData.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      
      // Create the user account
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        toast.success("Account created!");
        setStep(4);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (skipBusiness = false) => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Please sign in again");
        return;
      }

      // Upload logo if provided
      let logoUrl = "";
      if (logoFile && !skipBusiness) {
        // Logo upload implementation would go here
      }

      // Save profile
      const { error } = await supabase.from("user_profiles").upsert({
        id: user.id,
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone_number: formData.phoneNumber || null,
        phone_country_code: formData.phoneCountryCode,
        business_name: skipBusiness ? null : formData.businessName || null,
        business_logo_url: logoUrl || null,
        business_description: skipBusiness ? null : formData.businessDescription || null,
        business_size: skipBusiness ? "no_business" : formData.businessSize || null,
        default_video_quality: formData.defaultVideoQuality,
        referral_source: formData.referralSource || null,
        credits: 1, // Free tier starts with 1 credit
        onboarding_completed: step === 5,
      });

      if (error) throw error;

      if (step === 5) {
        // Complete onboarding
        toast.success("Welcome to AI Videographer!");
        router.push("/app");
        router.refresh();
        } else {
        setStep(step + 1);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.firstName && formData.lastName && formData.email;
      case 2:
        return otpVerified;
      case 3:
        return formData.password && formData.password === formData.confirmPassword && formData.password.length >= 8;
      case 4:
        return true; // Can skip
      case 5:
        return formData.defaultVideoQuality;
      default:
        return false;
    }
  };

  const handleNext = async () => {
    if (step === 1) {
      await handleSendOTP();
      if (formData.email) setStep(2);
    } else if (step === 3) {
      await handleCreateAccount();
    } else if (step === 4 || step === 5) {
      await handleSaveProfile(false);
    } else {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <div className="min-h-screen flex overflow-hidden">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#2A2F38] text-white flex-col justify-between p-12 overflow-y-auto">
        <div>
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00f0ff] flex items-center justify-center">
              <Video className="w-6 h-6 text-[#2A2F38]" />
            </div>
            <span className="text-xl font-bold">AI Videographer</span>
          </Link>
        </div>

        <div>
          <h1 className="text-4xl font-bold mb-4">Create your account</h1>
          <p className="text-white/60 text-lg mb-12">
            Join hundreds of creators and businesses who trust AI Videographer.
          </p>

          {/* Progress Steps */}
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                    s < step
                      ? "bg-[#00f0ff] text-[#2A2F38]"
                      : s === step
                      ? "bg-white text-[#2A2F38]"
                      : "bg-[#36454f] text-white/40"
                  )}
                >
                  {s < step ? <Check className="w-4 h-4" /> : s}
                </div>
                {s < 5 && (
                  <div
                    className={cn(
                      "w-8 h-0.5 mx-1",
                      s < step ? "bg-[#00f0ff]" : "bg-[#36454f]"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/40 text-sm">
          © {new Date().getFullYear()} AI Videographer. All rights reserved.
        </p>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#00f0ff] flex items-center justify-center">
                <Video className="w-6 h-6 text-[#2A2F38]" />
              </div>
              <span className="text-xl font-bold text-[#2A2F38]">AI Videographer</span>
            </Link>
          </div>

          <div className="mb-8">
            <p className="text-[#00f0ff] text-sm font-medium mb-2">
              Step {step} of {TOTAL_STEPS}
            </p>
            <h2 className="text-2xl font-bold text-[#2A2F38]">
              {step === 1 && "Let's get started"}
              {step === 2 && "Verify your email"}
              {step === 3 && "Create your password"}
              {step === 4 && "Tell us about your business"}
              {step === 5 && "Set your preferences"}
            </h2>
          </div>

          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    placeholder="John"
                    value={formData.firstName}
                    onChange={(e) => updateFormData("firstName", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={(e) => updateFormData("lastName", e.target.value)}
                  />
                </div>
              </div>

            <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                  placeholder="name@company.com"
                  value={formData.email}
                  onChange={(e) => updateFormData("email", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone number <span className="text-gray-400">(optional)</span></Label>
                <div className="flex gap-2">
                  <Select
                    value={formData.phoneCountryCode}
                    onValueChange={(value) => updateFormData("phoneCountryCode", value)}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue>
                        {countryCodes.find((c) => c.code === formData.phoneCountryCode)?.flag}{" "}
                        {formData.phoneCountryCode}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px] overflow-y-auto">
                      {countryCodes.map((country) => (
                        <SelectItem key={country.code} value={country.code}>
                          <span className="flex items-center gap-2">
                            <span>{country.flag}</span>
                            <span>{country.code}</span>
                            <span className="text-gray-400">{country.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="412 345 678"
                    value={formData.phoneNumber}
                    onChange={(e) => updateFormData("phoneNumber", e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: OTP Verification */}
          {step === 2 && (
            <div className="space-y-6">
              <p className="text-[#36454f]">
                We&apos;ve sent a 6-digit verification code to{" "}
                <span className="font-medium text-[#2A2F38]">{formData.email}</span>
              </p>

              <div className="space-y-2">
                <Label htmlFor="otp">Verification code</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={formData.otpCode}
                  onChange={(e) => updateFormData("otpCode", e.target.value.replace(/\D/g, ""))}
                  className="text-center text-2xl tracking-widest"
                />
              </div>

              <Button
                onClick={handleVerifyOTP}
                disabled={loading || formData.otpCode.length !== 6}
                className="w-full bg-[#00f0ff] hover:bg-[#00f0ff]/90 text-[#2A2F38] font-semibold"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Verify Code
              </Button>

              <div className="text-center">
                <p className="text-sm text-[#36454f]">
                  Didn&apos;t receive the code?{" "}
                  {resendCooldown > 0 ? (
                    <span className="text-gray-400">Resend in {resendCooldown}s</span>
                  ) : (
                    <button
                      onClick={handleSendOTP}
                      disabled={loading}
                      className="text-[#00f0ff] hover:underline font-medium"
                    >
                      Resend
                    </button>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Password */}
          {step === 3 && (
            <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => updateFormData("password", e.target.value)}
              />
                <p className="text-xs text-[#36454f]">Must be at least 8 characters</p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) => updateFormData("confirmPassword", e.target.value)}
                />
              </div>

              {formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="text-sm text-red-500">Passwords do not match</p>
              )}
            </div>
          )}

          {/* Step 4: Business Info */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business name</Label>
                <Input
                  id="businessName"
                  placeholder="Acme Inc."
                  value={formData.businessName}
                  onChange={(e) => updateFormData("businessName", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Business logo</Label>
                <div className="flex items-center gap-4">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="w-16 h-16 rounded-lg object-cover border" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center border border-dashed">
                      <Building2 className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    <span className="text-sm text-[#00f0ff] hover:underline flex items-center gap-1">
                      <Upload className="w-4 h-4" />
                      Upload logo
                    </span>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessDesc">What does your business do?</Label>
                <Textarea
                  id="businessDesc"
                  placeholder="We help companies create video content..."
                  value={formData.businessDescription}
                  onChange={(e) => updateFormData("businessDescription", e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Business size</Label>
                <Select
                  value={formData.businessSize}
                  onValueChange={(value) => updateFormData("businessSize", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px] overflow-y-auto">
                    {businessSizes.map((size) => (
                      <SelectItem key={size.value} value={size.value}>
                        {size.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <button
                onClick={() => handleSaveProfile(true)}
                className="text-sm text-[#36454f] hover:text-[#2A2F38] underline"
              >
                I don&apos;t have a business, skip this step
              </button>
            </div>
          )}

          {/* Step 5: Preferences */}
          {step === 5 && (
            <div className="space-y-6">
              <div className="space-y-3">
                <Label>Default video quality</Label>
                <div className="space-y-2">
                  {videoQualities.map((quality) => (
                    <label
                      key={quality.value}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all",
                        formData.defaultVideoQuality === quality.value
                          ? "border-[#00f0ff] bg-[#00f0ff]/5"
                          : "border-gray-200 hover:border-gray-300"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="quality"
                          value={quality.value}
                          checked={formData.defaultVideoQuality === quality.value}
                          onChange={(e) => updateFormData("defaultVideoQuality", e.target.value)}
                          className="sr-only"
                        />
                        <div
                          className={cn(
                            "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                            formData.defaultVideoQuality === quality.value
                              ? "border-[#00f0ff]"
                              : "border-gray-300"
                          )}
                        >
                          {formData.defaultVideoQuality === quality.value && (
                            <div className="w-2 h-2 rounded-full bg-[#00f0ff]" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-[#2A2F38]">{quality.label}</p>
                          <p className="text-sm text-[#36454f]">{quality.description}</p>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>How did you hear about us?</Label>
                <Select
                  value={formData.referralSource}
                  onValueChange={(value) => updateFormData("referralSource", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px] overflow-y-auto">
                    {referralSources.map((source) => (
                      <SelectItem key={source.value} value={source.value}>
                        {source.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          {step !== 2 && (
            <div className="mt-8 flex items-center gap-4">
              {step > 1 && step !== 3 && (
                <Button variant="outline" onClick={handleBack} disabled={loading}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              )}
              <Button
                onClick={handleNext}
                disabled={loading || !canProceed()}
                className="flex-1 bg-[#00f0ff] hover:bg-[#00f0ff]/90 text-[#2A2F38] font-semibold"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {step === 5 ? "Complete Setup" : "Continue"}
                <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            </div>
          )}

          <p className="text-center text-sm text-[#36454f] mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-[#00f0ff] hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
