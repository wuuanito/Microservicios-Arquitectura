pipeline {
  agent { label 'windows-docker' }
  environment { REGISTRY = 'ghcr.io'; OWNER = 'wuuanito' }
  options { skipDefaultCheckout(true) }

  stages {
    stage('Checkout'){ steps { checkout scm } }

    stage('Login GHCR') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'REGISTRY_CREDS', usernameVariable: 'REG_USER', passwordVariable: 'REG_PWD')]){
          bat """
          docker logout %REGISTRY% 2>nul
          echo %REG_PWD% | docker login %REGISTRY% -u %REG_USER% --password-stdin
          """
        }
      }
    }

    stage('Build & Push Services') {
      steps {
        script {
          def services = [
            [name: 'api-gateway',  path: 'api-gateway',  image: "${env.REGISTRY}/${env.OWNER}/api-gateway"],
            [name: 'auth-service', path: 'auth-service-microservice', image: "${env.REGISTRY}/${env.OWNER}/auth-service-microservice"],
            [name: 'websocket-server', path: 'websocket-server', image: "${env.REGISTRY}/${env.OWNER}/websocket-server"],
          ]
          services.each { s ->
            echo "Rebuild ${s.name}"
            bat """
            docker build --no-cache --pull ^
              -t ${s.image}:${env.BUILD_NUMBER} -t ${s.image}:latest ^
              -f ${s.path}\\Dockerfile ${s.path}
            docker push ${s.image}:${env.BUILD_NUMBER}
            docker push ${s.image}:latest
            """
          }
        }
      }
    }

    stage('Deploy Services') {
      steps {
        script {
          // Desplegar directamente en el servidor local donde corre Jenkins
          withCredentials([usernamePassword(credentialsId: 'REGISTRY_CREDS', usernameVariable: 'REG_USER', passwordVariable: 'REG_PWD')]){
            bat """
            REM Navegar al directorio del proyecto
            cd /d C:\opt\microservicios-arquitectura
            
            REM Login al registry
            docker logout ghcr.io 2>nul || echo "Already logged out"
            echo %REG_PWD% | docker login ghcr.io -u %REG_USER% --password-stdin
            
            REM Detener servicios actuales
            docker compose -p microservicios-arquitectura down --remove-orphans
            
            REM Descargar últimas imágenes
            docker compose -p microservicios-arquitectura pull
            
            REM Iniciar servicios actualizados
            docker compose -p microservicios-arquitectura up -d --force-recreate --remove-orphans
            """
          }
        }
      }
    }

    stage('Verify Deployment') {
      steps {
        script {
          // Verificar que los servicios estén funcionando
          bat """
            REM Esperar un momento para que los servicios se inicien
            timeout /t 30 /nobreak
            
            REM Verificar health checks
            curl -f http://localhost:6000/health || echo "API Gateway health check failed"
            curl -f http://localhost:6001/health || echo "Auth Service health check failed"
            curl -f http://localhost:6003/health || echo "WebSocket Server health check failed"
            
            REM Verificar estado de contenedores locales
            docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
          """
        }
      }
    }
  }

  post {
    success {
      script {
        try {
          def version = "v${env.BUILD_NUMBER}"
          def timestamp = System.currentTimeMillis()
          def project = env.JOB_NAME
          
          // Notificar al WebSocket server sobre el deployment exitoso
          bat """
            curl -X POST http://localhost:6003/notify-update ^
              -H "Content-Type: application/json" ^
              -d "{\"version\": \"${version}\", \"project\": \"${project}\", \"timestamp\": ${timestamp}}"
          """
          echo "Notificación enviada al WebSocket server: ${version}"
        } catch (Exception e) {
          echo "Error enviando notificación al WebSocket server: ${e.getMessage()}"
          // No fallar el build por esto
        }
      }
    }
    failure {
      echo "Build falló - no se enviará notificación de actualización"
    }
  }
}
