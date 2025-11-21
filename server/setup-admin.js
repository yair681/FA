import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in environment variables');
  process.exit(1);
}

async function setupAdmin() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // הגדרת הסכמה ומודל
    const userSchema = new mongoose.Schema({
      name: String,
      email: String,
      password: String,
      role: String,
      classes: Array,
      createdAt: Date
    });

    const User = mongoose.model('User', userSchema);

    // בדיקה אם המשתמש כבר קיים
    const existingAdmin = await User.findOne({ email: 'yairfrish2@gmail.com' });
    
    if (existingAdmin) {
      console.log('✅ Admin user already exists');
      console.log('📧 Email: yairfrish2@gmail.com');
      console.log('🔑 Password: yair12345');
      await mongoose.disconnect();
      return;
    }

    // יצירת מנהל מערכת ראשי
    const hashedPassword = await bcrypt.hash('yair12345', 10);
    
    const adminUser = new User({
      name: 'יאיר פריש',
      email: 'yairfrish2@gmail.com',
      password: hashedPassword,
      role: 'admin',
      classes: [],
      createdAt: new Date()
    });

    await adminUser.save();
    console.log('✅ Primary admin user created successfully');
    console.log('📧 Email: yairfrish2@gmail.com');
    console.log('🔑 Password: yair12345');
    console.log('🎯 Role: admin');

  } catch (error) {
    console.error('❌ Error setting up admin:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

setupAdmin();