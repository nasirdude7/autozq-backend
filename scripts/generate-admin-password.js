import bcryptjs from 'bcryptjs';

// 生成超级管理员密码 hash
const password = 'Admin@123';
const saltRounds = 10;

const hash = bcryptjs.hashSync(password, saltRounds);

console.log('='.repeat(60));
console.log('超级管理员账号信息');
console.log('='.repeat(60));
console.log('用户名: admin');
console.log('密码: Admin@123');
console.log('密码 Hash:', hash);
console.log('='.repeat(60));
console.log('\n正在更新数据库...\n');
