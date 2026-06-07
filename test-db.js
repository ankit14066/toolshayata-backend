const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://vivek:Vivek%40123@cluster0.9pp0aoy.mongodb.net/travelcrm').then(async () => {
  const User = mongoose.model('User', new mongoose.Schema({ username: String, is_active: Boolean, password: String }, { strict: false }));
  
  const username = 'Rahul52us@gmail.com';
  const escapedUsername = String(username).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  try {
    const user1 = await User.findOne({ username: { $regex: new RegExp(`^${escapedUsername}$`, 'i') } });
    console.log('Testing regex 1:', user1 ? user1.username : 'null');
    console.log('isActive:', user1 ? user1.isActive : 'undefined');
    console.log('is_active:', user1 ? user1.is_active : 'undefined');
    console.log('password in DB:', user1 ? user1.password : 'undefined');
    console.log('passwordHash in DB:', user1 ? user1.passwordHash : 'undefined');
    
    if (user1) {
      const jwt = require('jsonwebtoken');
      process.env.JWT_SECRET = 'local_dev_super_secret_change_me';
      const token = jwt.sign(
        {
          userId: user1._id.toString(),
          email: user1.email || user1.username,
          name: user1.name,
          role: user1.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );
      console.log('JWT generated successfully');
    }
  } catch (e) {
    console.error('Error:', e);
  }
  
  mongoose.disconnect();
}).catch(console.error);
