import express from 'express';
import rolesRoutes from '../src/modules/rbac/roles.routes';

const app = express();
app.use('/roles', rolesRoutes);

console.log('app.router keys:', Object.keys((app as any).router));
console.log('app.router.stack:', (app as any).router.stack);
