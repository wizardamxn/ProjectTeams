import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { GlassCard } from "@/components/GlassCard";
import { User, FileText, Settings, Shield, Bell, CreditCard, LogOut, Camera, Mail, Phone, MapPin, Calendar } from "lucide-react";
import { useState } from "react";

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState('profile');

  const menuItems = [
    { id: 'profile', label: 'Edit Profile', icon: User },
    { id: 'documents', label: 'Your Documents', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'privacy', label: 'Privacy & Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'billing', label: 'Billing', icon: CreditCard },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden p-6">
      {/* Background effects */}
      <div className="absolute inset-0 gradient-radial opacity-50" />

      <div className="relative z-10 max-w-7xl mx-auto">
        <Navbar />

        <div className="flex gap-6">
          <Sidebar />

          <main className="flex-1">
            {/* Profile Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <GlassCard>
                <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                  <div className="relative group">
                    <div className="w-32 h-32 rounded-2xl bg-gradient-purple-blue flex items-center justify-center text-4xl font-bold animate-glow">
                      JD
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="absolute bottom-0 right-0 p-2 glass-card rounded-lg hover:bg-primary/20 transition-colors"
                    >
                      <Camera className="w-4 h-4" />
                    </motion.button>
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <h1 className="text-3xl font-bold mb-2">John Doe</h1>
                    <p className="text-muted-foreground mb-4">Mental health advocate and wellness enthusiast</p>
                    <div className="flex flex-wrap gap-4 justify-center md:justify-start text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-4 h-4" />
                        <span>john.doe@example.com</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>Member since January 2025</span>
                      </div>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>

            {/* Navigation Tabs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-6"
            >
              <div className="glass-card p-2">
                <div className="flex flex-wrap gap-2">
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <motion.button
                        key={item.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setActiveTab(item.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                          activeTab === item.id
                            ? 'bg-gradient-purple-blue shadow-lg shadow-primary/50'
                            : 'hover:bg-white/5'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-sm font-medium">{item.label}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </motion.div>

            {/* Content Area */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {activeTab === 'profile' && <EditProfileSection />}
              {activeTab === 'documents' && <DocumentsSection />}
              {activeTab === 'settings' && <SettingsSection />}
              {activeTab === 'privacy' && <PrivacySection />}
              {activeTab === 'notifications' && <NotificationsSection />}
              {activeTab === 'billing' && <BillingSection />}
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  );
}

// Edit Profile Section
const EditProfileSection = () => (
  <GlassCard>
    <h2 className="text-2xl font-bold mb-6">Edit Profile</h2>
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium mb-2">First Name</label>
          <input
            type="text"
            defaultValue="John"
            className="glass-input w-full px-4 py-3 focus:ring-2 focus:ring-ring focus:outline-none transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Last Name</label>
          <input
            type="text"
            defaultValue="Doe"
            className="glass-input w-full px-4 py-3 focus:ring-2 focus:ring-ring focus:outline-none transition-all"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Email</label>
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="email"
            defaultValue="john.doe@example.com"
            className="glass-input w-full pl-12 pr-4 py-3 focus:ring-2 focus:ring-ring focus:outline-none transition-all"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Phone Number</label>
        <div className="relative">
          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="tel"
            defaultValue="+1 (555) 123-4567"
            className="glass-input w-full pl-12 pr-4 py-3 focus:ring-2 focus:ring-ring focus:outline-none transition-all"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Location</label>
        <div className="relative">
          <MapPin className="absolute left-4 top-4 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            defaultValue="San Francisco, CA"
            className="glass-input w-full pl-12 pr-4 py-3 focus:ring-2 focus:ring-ring focus:outline-none transition-all"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Bio</label>
        <textarea
          rows={4}
          defaultValue="Mental health advocate and wellness enthusiast. Passionate about helping others on their journey to better mental health."
          className="glass-input w-full px-4 py-3 focus:ring-2 focus:ring-ring focus:outline-none transition-all resize-none"
        />
      </div>

      <div className="flex gap-4">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="px-6 py-3 bg-gradient-purple-blue rounded-lg font-medium hover:shadow-lg hover:shadow-primary/50 transition-all"
        >
          Save Changes
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="px-6 py-3 glass-card hover:bg-white/10 rounded-lg font-medium transition-colors"
        >
          Cancel
        </motion.button>
      </div>
    </div>
  </GlassCard>
);

// Documents Section
const DocumentsSection = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    {[
      { name: 'Therapy Session Notes - Jan 2025.pdf', size: '2.4 MB', date: 'Jan 15, 2025', type: 'Session Notes' },
      { name: 'Mental Health Assessment.pdf', size: '1.8 MB', date: 'Jan 10, 2025', type: 'Assessment' },
      { name: 'Mood Journal Export.csv', size: '156 KB', date: 'Jan 5, 2025', type: 'Journal' },
      { name: 'Prescription History.pdf', size: '890 KB', date: 'Dec 28, 2024', type: 'Prescription' },
      { name: 'Coping Strategies Guide.pdf', size: '3.2 MB', date: 'Dec 20, 2024', type: 'Guide' },
      { name: 'Progress Report Q4 2024.pdf', size: '1.5 MB', date: 'Dec 15, 2024', type: 'Report' },
    ].map((doc, idx) => (
      <motion.div
        key={idx}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: idx * 0.1 }}
      >
        <GlassCard>
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold mb-1 truncate">{doc.name}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{doc.size}</span>
                <span>•</span>
                <span>{doc.date}</span>
              </div>
            </div>
          </div>
          <div className="mb-4">
            <span className="px-3 py-1 bg-secondary/20 text-secondary text-xs rounded-lg">
              {doc.type}
            </span>
          </div>
          <div className="flex gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex-1 glass-card px-4 py-2 hover:bg-primary/10 transition-colors rounded-lg text-sm font-medium"
            >
              Download
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="glass-card px-4 py-2 hover:bg-destructive/10 transition-colors rounded-lg text-sm font-medium"
            >
              Delete
            </motion.button>
          </div>
        </GlassCard>
      </motion.div>
    ))}
  </div>
);

// Settings Section
const SettingsSection = () => (
  <div className="space-y-6">
    <GlassCard>
      <h3 className="text-lg font-semibold mb-4">Appearance</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 glass-card rounded-lg">
          <div>
            <p className="font-medium">Dark Mode</p>
            <p className="text-sm text-muted-foreground">Enable dark theme across the platform</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" defaultChecked />
            <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-gradient-purple-blue peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
          </label>
        </div>
        <div className="flex items-center justify-between p-4 glass-card rounded-lg">
          <div>
            <p className="font-medium">Reduced Motion</p>
            <p className="text-sm text-muted-foreground">Minimize animations and transitions</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" />
            <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-gradient-purple-blue peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
          </label>
        </div>
      </div>
    </GlassCard>

    <GlassCard>
      <h3 className="text-lg font-semibold mb-4">Language & Region</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Language</label>
          <select className="glass-input w-full px-4 py-3 focus:ring-2 focus:ring-ring focus:outline-none transition-all">
            <option>English</option>
            <option>Spanish</option>
            <option>French</option>
            <option>German</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Timezone</label>
          <select className="glass-input w-full px-4 py-3 focus:ring-2 focus:ring-ring focus:outline-none transition-all">
            <option>UTC-5 (Eastern Time)</option>
            <option>UTC-8 (Pacific Time)</option>
            <option>UTC+0 (GMT)</option>
            <option>UTC+5:30 (IST)</option>
          </select>
        </div>
      </div>
    </GlassCard>
  </div>
);

// Privacy Section
const PrivacySection = () => (
  <div className="space-y-6">
    <GlassCard>
      <h3 className="text-lg font-semibold mb-4">Change Password</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Current Password</label>
          <input
            type="password"
            placeholder="Enter current password"
            className="glass-input w-full px-4 py-3 focus:ring-2 focus:ring-ring focus:outline-none transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">New Password</label>
          <input
            type="password"
            placeholder="Enter new password"
            className="glass-input w-full px-4 py-3 focus:ring-2 focus:ring-ring focus:outline-none transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Confirm New Password</label>
          <input
            type="password"
            placeholder="Confirm new password"
            className="glass-input w-full px-4 py-3 focus:ring-2 focus:ring-ring focus:outline-none transition-all"
          />
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="px-6 py-3 bg-gradient-purple-blue rounded-lg font-medium hover:shadow-lg hover:shadow-primary/50 transition-all"
        >
          Update Password
        </motion.button>
      </div>
    </GlassCard>

    <GlassCard>
      <h3 className="text-lg font-semibold mb-4">Two-Factor Authentication</h3>
      <p className="text-muted-foreground mb-4">Add an extra layer of security to your account</p>
      <div className="flex items-center justify-between p-4 glass-card rounded-lg mb-4">
        <div>
          <p className="font-medium">2FA Status</p>
          <p className="text-sm text-muted-foreground">Currently disabled</p>
        </div>
        <span className="px-3 py-1 bg-destructive/20 text-destructive text-sm rounded-lg">Disabled</span>
      </div>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="px-6 py-3 bg-secondary/20 text-secondary hover:bg-secondary/30 rounded-lg font-medium transition-colors"
      >
        Enable 2FA
      </motion.button>
    </GlassCard>

    <GlassCard>
      <h3 className="text-lg font-semibold mb-4">Data Privacy</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 glass-card rounded-lg">
          <div className="flex-1 mr-4">
            <p className="font-medium">Profile Visibility</p>
            <p className="text-sm text-muted-foreground">Control who can see your profile</p>
          </div>
          <select className="glass-input px-4 py-2 focus:ring-2 focus:ring-ring focus:outline-none transition-all">
            <option>Everyone</option>
            <option>Therapists Only</option>
            <option>Private</option>
          </select>
        </div>
        <div className="flex items-center justify-between p-4 glass-card rounded-lg">
          <div>
            <p className="font-medium">Show Activity Status</p>
            <p className="text-sm text-muted-foreground">Let others see when you're online</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" />
            <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-gradient-purple-blue peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
          </label>
        </div>
      </div>
    </GlassCard>
  </div>
);

// Notifications Section
const NotificationsSection = () => (
  <GlassCard>
    <h3 className="text-xl font-bold mb-6">Notification Preferences</h3>
    <div className="space-y-3">
      {[
        { title: 'Appointment Reminders', desc: 'Get notified before scheduled therapy sessions', checked: true },
        { title: 'Mood Check-ins', desc: 'Daily reminders to log your mood', checked: true },
        { title: 'Community Updates', desc: 'New posts and replies in your communities', checked: true },
        { title: 'Weekly Progress Report', desc: 'Summary of your mental health journey', checked: false },
        { title: 'New Messages', desc: 'Notifications for new direct messages', checked: true },
        { title: 'Marketing Emails', desc: 'Updates about new features and tips', checked: false },
      ].map((item, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.1 }}
          className="flex items-center justify-between p-4 glass-card rounded-lg hover:bg-white/5 transition-colors"
        >
          <div>
            <p className="font-medium">{item.title}</p>
            <p className="text-sm text-muted-foreground">{item.desc}</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" defaultChecked={item.checked} />
            <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-gradient-purple-blue peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
          </label>
        </motion.div>
      ))}
    </div>
  </GlassCard>
);

// Billing Section
const BillingSection = () => (
  <div className="space-y-6">
    <GlassCard>
      <h3 className="text-lg font-semibold mb-6">Current Plan</h3>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-3xl font-bold gradient-purple-blue bg-clip-text text-transparent mb-2">Premium Plan</p>
          <p className="text-muted-foreground">$29.99/month</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="px-6 py-3 bg-secondary/20 text-secondary hover:bg-secondary/30 rounded-lg font-medium transition-colors"
        >
          Upgrade Plan
        </motion.button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          'Unlimited therapy sessions',
          'Priority support',
          'Advanced analytics & insights',
          'Custom mood tracking',
          'Export all your data',
          'Ad-free experience',
        ].map((feature, idx) => (
          <div key={idx} className="flex items-center gap-3 p-3 glass-card rounded-lg">
            <div className="w-2 h-2 rounded-full bg-gradient-purple-blue"></div>
            <span className="text-sm">{feature}</span>
          </div>
        ))}
      </div>
    </GlassCard>

    <GlassCard>
      <h3 className="text-lg font-semibold mb-4">Payment Method</h3>
      <div className="flex items-center gap-4 p-4 glass-card rounded-lg mb-4">
        <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
          <CreditCard className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
          <p className="font-medium">Visa ending in 4242</p>
          <p className="text-sm text-muted-foreground">Expires 12/2026</p>
        </div>
        <span className="px-3 py-1 bg-primary/20 text-primary text-xs rounded-lg">Primary</span>
      </div>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="glass-card px-6 py-3 hover:bg-white/10 rounded-lg font-medium transition-colors"
      >
        Update Payment Method
      </motion.button>
    </GlassCard>

    <GlassCard>
      <h3 className="text-lg font-semibold mb-4">Billing History</h3>
      <div className="space-y-3">
        {[
          { date: 'Jan 1, 2025', amount: '$29.99', status: 'Paid', invoice: 'INV-2025-001' },
          { date: 'Dec 1, 2024', amount: '$29.99', status: 'Paid', invoice: 'INV-2024-012' },
          { date: 'Nov 1, 2024', amount: '$29.99', status: 'Paid', invoice: 'INV-2024-011' },
        ].map((invoice, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="flex items-center justify-between p-4 glass-card rounded-lg hover:bg-white/5 transition-colors"
          >
            <div>
              <p className="font-medium">{invoice.date}</p>
              <p className="text-sm text-muted-foreground">{invoice.invoice}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-semibold">{invoice.amount}</p>
                <span className="px-2 py-1 bg-primary/20 text-primary text-xs rounded-full">{invoice.status}</span>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="text-primary hover:underline text-sm"
              >
                Download
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>
    </GlassCard>
  </div>
);