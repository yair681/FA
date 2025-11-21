import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function setupAdmin() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // סכמת משתמש
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
    } else {
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
    }

    // יצירת מורה לדוגמה
    const existingTeacher = await User.findOne({ email: 'teacher@school.com' });
    if (!existingTeacher) {
      const teacherPassword = await bcrypt.hash('123456', 10);
      const teacherUser = new User({
        name: 'מורה לדוגמה',
        email: 'teacher@school.com',
        password: teacherPassword,
        role: 'teacher',
        classes: [],
        createdAt: new Date()
      });
      await teacherUser.save();
      console.log('✅ Teacher user created');
      console.log('📧 Email: teacher@school.com');
      console.log('🔑 Password: 123456');
    }

  } catch (error) {
    console.error('❌ Error setting up users:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

setupAdmin();
