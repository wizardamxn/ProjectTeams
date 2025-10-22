import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { FileText, LogOut, User } from "lucide-react";

export const Navbar = () => { 
  const navigate = useNavigate()
  const handleNavigate = () => {
    navigate('/profile')
  }
  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card px-6 py-4 mb-6 flex items-center justify-between"
    >
      <Link to="/dashboard" className="flex items-center gap-2">
        <div className="w-8 h-8 bg-gradient-purple-blue rounded-lg flex items-center justify-center">
          <FileText className="w-5 h-5" />
        </div>
        <span className="text-xl font-semibold">Project Teams</span>
      </Link>
      
      <div className="flex items-center gap-4">
        <button className="glass-card px-4 py-2 hover:bg-white/40 transition-colors rounded-lg flex items-center gap-2 cursor-pointer">
          <User className="w-4 h-4" />
          <span onClick={handleNavigate} className="text-sm ">Profile</span>
        </button>
        <button className="glass-card px-4 py-2 hover:bg-destructive/20 transition-colors rounded-lg flex items-center gap-2 cursor-pointer">
          <LogOut className="w-4 h-4" />
          <span className="text-sm">Logout</span>
        </button>
      </div>
    </motion.nav>
  );
};
