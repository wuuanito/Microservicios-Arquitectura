# Guía de Pruebas de API - Sistema de Autenticación

## Configuración del Sistema

El sistema utiliza:
- **Usuario**: En lugar de email para autenticación
- **Campos requeridos**: usuario, password, email, departamento, rol
- **Servidor**: http://192.168.11.7:6000

## Opción 1: Usar Postman

### Importar Colección
1. Abrir Postman
2. Importar el archivo `postman_collection.json`
3. La variable `base_url` ya está configurada como `http://192.168.11.7:6000`

### Flujo de Pruebas
1. **Registro**: Ejecutar "Register User" con datos de ejemplo
2. **Login**: Ejecutar "Login User" (automáticamente guarda el token)
3. **Perfil**: Usar "Get Profile" para ver datos del usuario
4. **Logout**: Ejecutar "Logout User" para cerrar sesión

## Opción 2: Usar PowerShell (Invoke-RestMethod)

### 1. Registro de Usuario
```powershell
$registerBody = @{
    usuario = "testuser123"
    password = "Password123"
    email = "testuser123@example.com"
    departamento = "informatica"
    rol = "usuario"
} | ConvertTo-Json

Invoke-RestMethod -Uri 'http://192.168.11.7:6000/api/auth/v1/register' `
    -Method POST `
    -Headers @{'Content-Type'='application/json'} `
    -Body $registerBody `
    -TimeoutSec 30
```

### 2. Login de Usuario
```powershell
$loginBody = @{
    usuario = "testuser123"
    password = "Password123"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri 'http://192.168.11.7:6000/api/auth/v1/login' `
    -Method POST `
    -Headers @{'Content-Type'='application/json'} `
    -Body $loginBody `
    -TimeoutSec 30

# Guardar token para uso posterior
$accessToken = $loginResponse.accessToken
Write-Host "Token obtenido: $accessToken"
```

### 3. Obtener Perfil de Usuario
```powershell
Invoke-RestMethod -Uri 'http://192.168.11.7:6000/api/user/v1/profile' `
    -Method GET `
    -Headers @{
        'Authorization' = "Bearer $accessToken"
        'Content-Type' = 'application/json'
    } `
    -TimeoutSec 30
```

### 4. Actualizar Perfil
```powershell
$updateBody = @{
    email = "newemail@example.com"
    departamento = "gerencia"
} | ConvertTo-Json

Invoke-RestMethod -Uri 'http://192.168.11.7:6000/api/user/v1/profile' `
    -Method PUT `
    -Headers @{
        'Authorization' = "Bearer $accessToken"
        'Content-Type' = 'application/json'
    } `
    -Body $updateBody `
    -TimeoutSec 30
```

### 5. Logout
```powershell
Invoke-RestMethod -Uri 'http://192.168.11.7:6000/api/auth/v1/logout' `
    -Method POST `
    -Headers @{
        'Authorization' = "Bearer $accessToken"
    } `
    -TimeoutSec 30
```

## Departamentos Válidos
- administracion
- compras
- informatica
- gerencia
- rrhh
- produccion
- softgel
- calidad
- laboratorio
- mantenimiento
- oficina_tecnica
- logistica

## Roles Válidos
- administrador
- director
- usuario

## Solución de Problemas

### Error: "firstName" y "lastName" requeridos
Este error indica que el contenedor Docker no se ha actualizado con los cambios más recientes. Para solucionarlo:

1. Detener contenedores:
```powershell
docker-compose down
```

2. Reconstruir sin caché:
```powershell
docker-compose build --no-cache
```

3. Iniciar servicios:
```powershell
docker-compose up -d
```

### Error: "X-Forwarded-For header"
Este error ya está resuelto con la configuración `trust proxy` en el código.

### Error: "Gateway timeout"
Aumentar el timeout en las peticiones o verificar que todos los servicios estén ejecutándose correctamente.

## Notas Importantes

- El sistema usa **usuario** en lugar de **email** para autenticación
- Las contraseñas deben tener al menos 6 caracteres con mayúscula, minúscula y número
- Los tokens de acceso se incluyen automáticamente en las cookies de sesión
- El rate limiting permite máximo 5 intentos de login por IP cada 15 minutos