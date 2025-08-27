pipeline {
  agent none

  environment {
    REGISTRY = 'ghcr.io'
    OWNER    = 'wuuanito'
  }

  stages {
    stage('Detectar servicios cambiados') {
      agent any
      steps {
        script {
          // servicio en compose -> { path repo, imagen GHCR }
          def catalog = [
            'api-gateway' : [path: 'api-gateway',               image: "${env.REGISTRY}/${env.OWNER}/api-gateway"],
            'auth-service': [path: 'auth-service-microservice', image: "${env.REGISTRY}/${env.OWNER}/auth-service"],
          ]

          def changedFiles = []
          if (env.GIT_PREVIOUS_SUCCESSFUL_COMMIT) {
            def out = sh(returnStdout: true, script: 'git diff --name-only $GIT_PREVIOUS_SUCCESSFUL_COMMIT HEAD').trim()
            if (out) changedFiles = out.split(/\r?\n/).collect { it.replace('\\','/') }
          } else {
            echo 'Primer build: construir todos los servicios.'
            changedFiles = ['__build_all__']
          }

          def changedServices = catalog.keySet().findAll { svc ->
            changedFiles.contains('__build_all__') || changedFiles.any { it.startsWith("${catalog[svc].path}/") }
          }

          if (!changedServices) {
            echo 'No hay cambios en carpetas de servicios. Fin.'
            env.CHANGED_SERVICES = ''
            return
          }

          env.CHANGED_SERVICES = changedServices.join(',')
          // Guardamos también un catálogo “serializado” simple para reusarlo sin JSON
          env.CAT_API_GATEWAY_PATH = catalog['api-gateway'].path
          env.CAT_API_GATEWAY_IMG  = catalog['api-gateway'].image
          env.CAT_AUTH_PATH        = catalog['auth-service'].path
          env.CAT_AUTH_IMG         = catalog['auth-service'].image

          echo "Servicios a construir: ${env.CHANGED_SERVICES}"
        }
      }
    }

    stage('Login + Build & Push') {
      when { expression { return env.CHANGED_SERVICES?.trim() } }
      agent any
      options {
        timeout(time: 30, unit: 'MINUTES')
      }
      steps {
        withCredentials([usernamePassword(credentialsId: 'REGISTRY_CREDS', usernameVariable: 'REG_USER', passwordVariable: 'REG_PWD')]) {
          sh '''
          docker logout ghcr.io 2>/dev/null || true
          echo $REG_PWD | docker login ghcr.io -u $REG_USER --password-stdin
          '''
        }
        script {
          def services = env.CHANGED_SERVICES.split(',') as List
          for (svc in services) {
            if (svc == 'api-gateway') {
              sh """
              docker build -t ${env.CAT_API_GATEWAY_IMG}:${env.BUILD_NUMBER} -t ${env.CAT_API_GATEWAY_IMG}:latest -f ${env.CAT_API_GATEWAY_PATH}/Dockerfile ${env.CAT_API_GATEWAY_PATH}
              """
              retry(3) {
                sh """
                docker push ${env.CAT_API_GATEWAY_IMG}:${env.BUILD_NUMBER}
                docker push ${env.CAT_API_GATEWAY_IMG}:latest
                """
              }
              // Limpiar imágenes locales para liberar espacio
              sh """
              docker rmi ${env.CAT_API_GATEWAY_IMG}:${env.BUILD_NUMBER} ${env.CAT_API_GATEWAY_IMG}:latest 2>/dev/null || echo "Images already removed"
              """
            } else if (svc == 'auth-service') {
              sh """
              docker build -t ${env.CAT_AUTH_IMG}:${env.BUILD_NUMBER} -t ${env.CAT_AUTH_IMG}:latest -f ${env.CAT_AUTH_PATH}/Dockerfile ${env.CAT_AUTH_PATH}
              """
              retry(3) {
                sh """
                docker push ${env.CAT_AUTH_IMG}:${env.BUILD_NUMBER}
                docker push ${env.CAT_AUTH_IMG}:latest
                """
              }
              // Limpiar imágenes locales para liberar espacio
              sh """
              docker rmi ${env.CAT_AUTH_IMG}:${env.BUILD_NUMBER} ${env.CAT_AUTH_IMG}:latest 2>/dev/null || echo "Images already removed"
              """
            } else {
              error "Servicio no mapeado: ${svc}"
            }
          }
        }
      }
    }

    stage('Disparar deploy(s)') {
      when { expression { return env.CHANGED_SERVICES?.trim() } }
      agent none
      steps {
        script {
          def services = env.CHANGED_SERVICES.split(',') as List
          for (svc in services) {
            build job: 'arquitectura-deploy', parameters: [
              string(name: 'SERVICE', value: svc),
              string(name: 'TAG',     value: "${env.BUILD_NUMBER}")
            ]
          }
        }
      }
    }
  }
}
