import dbConnect from './mongodb';
import User from '@/models/User';

const SUPER_ADMIN_EMAIL = 'eddy@altavista.com';
const SUPER_ADMIN_PASSWORD = 'eddy123';
const SUPER_ADMIN_NAME = 'Eddy Super Admin';

export async function seedSuperAdmin() {
  try {
    await dbConnect();

    const existingAdmin = await User.findOne({ email: SUPER_ADMIN_EMAIL });
    if (existingAdmin) {
      console.log('Super Admin already exists, skipping seed.');
      return existingAdmin;
    }

    const admin = await User.create({
      name: SUPER_ADMIN_NAME,
      email: SUPER_ADMIN_EMAIL,
      passwordHash: SUPER_ADMIN_PASSWORD,
      role: 'super_admin',
    });

    console.log('Super Admin created successfully:', admin.email);
    return admin;
  } catch (error) {
    console.error('Error seeding Super Admin:', error);
    throw error;
  }
}