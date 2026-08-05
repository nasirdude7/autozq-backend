/**
 * 用户模型（基于JSON文件存储）
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 初始化用户文件
if (!fs.existsSync(USERS_FILE)) {
  const defaultUsers = [
    {
      id: 'admin-001',
      username: 'admin',
      email: 'admin@autozq.ru',
      password: bcrypt.hashSync('admin123', 10), // 默认密码
      role: 'admin',
      sites: ['autozqi-ru'], // 管理员可以访问所有站点
      apiKeys: {},
      createdAt: new Date().toISOString(),
      lastLogin: null
    }
  ];
  fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
}

/**
 * 读取所有用户
 */
export function getAllUsers() {
  const data = fs.readFileSync(USERS_FILE, 'utf8');
  return JSON.parse(data);
}

/**
 * 保存用户数据
 */
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

/**
 * 根据用户名查找用户
 */
export function findUserByUsername(username) {
  const users = getAllUsers();
  return users.find(u => u.username === username);
}

/**
 * 根据ID查找用户
 */
export function findUserById(id) {
  const users = getAllUsers();
  return users.find(u => u.id === id);
}

/**
 * 创建新用户
 */
export function createUser({ username, email, password, role = 'user', sites = [] }) {
  const users = getAllUsers();

  // 检查用户名是否已存在
  if (users.some(u => u.username === username)) {
    throw new Error('用户名已存在');
  }

  const newUser = {
    id: `user-${Date.now()}`,
    username,
    email,
    password: bcrypt.hashSync(password, 10),
    role,
    sites,
    apiKeys: {},
    createdAt: new Date().toISOString(),
    lastLogin: null
  };

  users.push(newUser);
  saveUsers(users);

  // 返回用户信息（不包含密码）
  const { password: _, ...userWithoutPassword } = newUser;
  return userWithoutPassword;
}

/**
 * 更新用户
 */
export function updateUser(id, updates) {
  const users = getAllUsers();
  const index = users.findIndex(u => u.id === id);

  if (index === -1) {
    throw new Error('用户不存在');
  }

  // 如果更新密码，需要加密
  if (updates.password) {
    updates.password = bcrypt.hashSync(updates.password, 10);
  }

  users[index] = { ...users[index], ...updates };
  saveUsers(users);

  const { password: _, ...userWithoutPassword } = users[index];
  return userWithoutPassword;
}

/**
 * 删除用户
 */
export function deleteUser(id) {
  const users = getAllUsers();
  const filtered = users.filter(u => u.id !== id);

  if (filtered.length === users.length) {
    throw new Error('用户不存在');
  }

  saveUsers(filtered);
  return true;
}

/**
 * 验证密码
 */
export function verifyPassword(user, password) {
  return bcrypt.compareSync(password, user.password);
}

/**
 * 更新最后登录时间
 */
export function updateLastLogin(id) {
  const users = getAllUsers();
  const index = users.findIndex(u => u.id === id);

  if (index !== -1) {
    users[index].lastLogin = new Date().toISOString();
    saveUsers(users);
  }
}
