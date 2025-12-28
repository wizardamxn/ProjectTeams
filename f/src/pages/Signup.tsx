import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { FileText, Mail, Lock, User, ArrowRight } from "lucide-react";
import { useState } from "react";

export default function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    // Add axios call here later
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4 font-sans selection:bg-zinc-800">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[400px]"
      >
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center mb-4 shadow-sm">
                <FileText className="w-6 h-6 text-zinc-100" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Create an account</h1>
            <p className="text-sm text-zinc-400 mt-2">Start collaborating with your team today</p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 shadow-xl backdrop-blur-sm">
          <form onSubmit={handleSignup} className="space-y-4">
            
            {/* Name Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Full Name</label>
              <div className="relative group">
                <User className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500 group-focus-within:text-white transition-colors" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-zinc-950/50 border border-zinc-800 focus:border-zinc-600 rounded-lg py-2 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 outline-none transition-all"
                  placeholder="John Doe"
                  required
                />
              </div>
            </div>

            {/* Email Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Email</label>
              <div className="relative group">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500 group-focus-within:text-white transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-950/50 border border-zinc-800 focus:border-zinc-600 rounded-lg py-2 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 outline-none transition-all"
                  placeholder="name@company.com"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Password</label>
              <div className="relative group">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500 group-focus-within:text-white transition-colors" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-950/50 border border-zinc-800 focus:border-zinc-600 rounded-lg py-2 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full bg-zinc-100 hover:bg-white text-zinc-950 font-medium py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 mt-2"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-zinc-500 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-zinc-200 hover:text-white font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}