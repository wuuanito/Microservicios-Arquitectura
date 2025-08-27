pipeline {
  agent { label 'windows-docker' }

  environment {
    REGISTRY = 'ghcr.io'
    OWNER    = 'wuuanito'
  }

  options { skipDefaultCheckout(false) }

  stages {
    stage('Detectar servicios cambiados') {
      steps {
        script {
          // nombre compose -> { path del repo, imagen GHCR }
          def catalog = [
            'api-gateway' : [path: 'api-gateway',               image: "${env.REGISTRY}/${env.OWNER}/api-gateway"],
            'auth-service': [path: 'auth-service-microservice', image: "${env.REGISTRY}/${env.OWNER}/auth-service-microservice"],
          ]

          def changedFiles = []
          if (env.GIT_PREVIOUS_SUCCESSFUL_COMMIT) {
            def out = bat(returnStdout: true, script: 'git diff --name-only %GIT_PREVIOUS_SUCCESSFUL_COMMIT% HEAD').trim()
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
            currentBuild.description = 'No service changes'
            env.CHANGED_SERVICES = ''
            return
          }

          env.CHANGED_SERVICES = changedServices.join(',')
          echo "Servicios a construir: ${env.CHANGED_SERVICES}"
        }
      }
    }

    stage('Login GHCR') {
      when { expression { return env.CHANGED_SERVICES?.trim() } }
      steps {
        withCredentials([usernamePassword(credentialsId: 'REGISTRY_CREDS', usernameVariable: 'REG_USER', passwordVariable: 'REG_PWD')]) {
          bat '''
          docker logout ghcr.io 2>nul
          echo %REG_PWD% | docker login ghcr.io -u %REG_USER% --password-stdin
          '''
        }
      }
    }

    stage('Build & Push + Deploy') {
      when { expression { return env.CHANGED_SERVICES?.trim() } }
      steps {
        script {
          def catalog = [
            'api-gateway' : [path: 'api-gateway',               image: "${env.REGISTRY}/${env.OWNER}/api-gateway"],
            'auth-service': [path: 'auth-service-microservice', image: "${env.REGISTRY}/${env.OWNER}/auth-service-microservice"],
          ]

          def services = env.CHANGED_SERVICES.split(',') as List
          for (svc in services) {
            def meta = catalog[svc]
            if (!meta) { error "Servicio no mapeado: ${svc}" }

            stage("Build & Push: ${svc}") {
              bat """
              docker build -t ${meta.image}:${env.BUILD_NUMBER} -t ${meta.image}:latest -f ${meta.path}\\Dockerfile ${meta.path}
              docker push ${meta.image}:${env.BUILD_NUMBER}
              docker push ${meta.image}:latest
              """
            }
            stage("Deploy: ${svc}") {
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
}
