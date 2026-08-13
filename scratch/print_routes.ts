import express from 'express';
import authRoutes from '../src/modules/auth/auth.routes';
import rolesRoutes from '../src/modules/rbac/roles.routes';
import permissionsRoutes from '../src/modules/rbac/permissions.routes';

const app = express();
app.use('/employee-api/auth', authRoutes);
app.use('/employee-api/roles', rolesRoutes);
app.use('/employee-api/permissions', permissionsRoutes);

function printRoutes(path: string, layer: any) {
  if (layer.route) {
    layer.route.stack.forEach((stackElement: any) => {
      console.log(`${stackElement.method.toUpperCase()} ${path}${layer.route.path}`);
    });
  } else if (layer.name === 'router' && layer.handle.stack) {
    // Clean regex source to make path readable
    let regexSource = layer.regexp?.source || '';
    let cleanPath = '';
    if (regexSource.includes('roles')) {
      cleanPath = 'roles/';
    } else if (regexSource.includes('auth')) {
      cleanPath = 'auth/';
    } else if (regexSource.includes('permissions')) {
      cleanPath = 'permissions/';
    }
    
    layer.handle.stack.forEach((stackElement: any) => {
      printRoutes(path + cleanPath, stackElement);
    });
  }
}

(app as any).router.stack.forEach((layer: any) => {
  printRoutes('/employee-api/', layer);
});
