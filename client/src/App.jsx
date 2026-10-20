import { Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { ROLE_LABEL, Spinner } from './ui.jsx';
import Login from './pages/Login.jsx';
import ChangePassword from './pages/ChangePassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ModulePlayer from './pages/ModulePlayer.jsx';
import { RecipeList, RecipeDetail } from './pages/Recipes.jsx';
import Team from './pages/Team.jsx';
import Users from './pages/Users.jsx';
import { ModuleList, ModuleEditor } from './pages/ModulesAdmin.jsx';
import { RecipeAdminList, RecipeEditor } from './pages/RecipesAdmin.jsx';
import Org from './pages/Org.jsx';
import Audit from './pages/Audit.jsx';
import Email from './pages/Email.jsx';

const LEARNERS = ['team_member', 'outlet_incharge', 'franchisee'];
const MANAGERS = ['super_admin', 'training_admin', 'outlet_incharge', 'franchisee'];

function navFor(user) {
  const items = [];
  if (LEARNERS.includes(user.role)) items.push({ to: '/', icon: '🎓', label: 'Training', end: true }, { to: '/recipes', icon: '🍳', label: 'Recipes' });
  if (MANAGERS.includes(user.role)) items.push({ to: '/team', icon: '📊', label: user.isAdmin ? 'Reports' : 'My team' });
  if (user.isAdmin) items.push({ to: '/manage/modules', icon: '📚', label: 'Modules' }, { to: '/manage/recipes', icon: '📖', label: 'Recipes' });
  if (user.role === 'super_admin') items.push({ to: '/manage/users', icon: '👥', label: 'Users' }, { to: '/manage/org', icon: '🏪', label: 'Outlets' }, { to: '/manage/email', icon: '✉️', label: 'Email' });
  if (user.isAdmin) items.push({ to: '/manage/audit', icon: '🧾', label: 'Audit' });
  return items;
}

function Shell() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  if (user === undefined) return <div className="center"><Spinner /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.must_change_password && pathname !== '/change-password') return <Navigate to="/change-password" replace />;
  return (
    <div className="shell">
      <div className="topbar">
        <a className="logo" href="/">🍳 Staff Training</a>
        <div className="row">
          <div className="who">{user.name}<br /><span style={{ opacity: 0.8 }}>{ROLE_LABEL[user.role]}{user.outlet_name ? ` · ${user.outlet_name}` : ''}</span></div>
          <button onClick={logout}>Sign out</button>
        </div>
      </div>
      {!user.must_change_password && (
        <nav className="nav" aria-label="Main">
          {navFor(user).map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end}><span aria-hidden>{i.icon}</span><span>{i.label}</span></NavLink>
          ))}
        </nav>
      )}
      <main><Outlet /></main>
    </div>
  );
}

function RequireRole({ roles, children }) {
  const { user } = useAuth();
  return roles.includes(user.role) ? children : <Navigate to="/" replace />;
}

function Home() {
  const { user } = useAuth();
  return LEARNERS.includes(user.role) ? <Dashboard /> : <Navigate to="/team" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Shell />}>
        <Route path="/" element={<Home />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/modules/:id" element={<RequireRole roles={LEARNERS}><ModulePlayer /></RequireRole>} />
        <Route path="/recipes" element={<RecipeList />} />
        <Route path="/recipes/:id" element={<RecipeDetail />} />
        <Route path="/team" element={<RequireRole roles={MANAGERS}><Team /></RequireRole>} />
        <Route path="/manage/modules" element={<RequireRole roles={['super_admin', 'training_admin']}><ModuleList /></RequireRole>} />
        <Route path="/manage/modules/:id" element={<RequireRole roles={['super_admin', 'training_admin']}><ModuleEditor /></RequireRole>} />
        <Route path="/manage/recipes" element={<RequireRole roles={['super_admin', 'training_admin']}><RecipeAdminList /></RequireRole>} />
        <Route path="/manage/recipes/:id" element={<RequireRole roles={['super_admin', 'training_admin']}><RecipeEditor /></RequireRole>} />
        <Route path="/manage/users" element={<RequireRole roles={['super_admin']}><Users /></RequireRole>} />
        <Route path="/manage/email" element={<RequireRole roles={['super_admin']}><Email /></RequireRole>} />
        <Route path="/manage/org" element={<RequireRole roles={['super_admin']}><Org /></RequireRole>} />
        <Route path="/manage/audit" element={<RequireRole roles={['super_admin', 'training_admin']}><Audit /></RequireRole>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
