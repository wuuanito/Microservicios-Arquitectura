pipeline {
  agent { label 'windows-docker' }

  environment {
    REGISTRY = 'ghcr.io'
    OWNER    = 'wuuanito'
  }

  options { skipDefaultCheckout(false) }  // Jenkins hace checkout del repo

  // En el job activarás "Consultar repositorio (SCM)" con un cron (ver paso 3)
  triggers { }

  stages {
    stage('Detectar servicios cambiados') {
      steps {
        script {
          // nombre en docker-compose | carpeta en repo                  | nombre de imagen en GHCR
          def catalog = [
            [name: 'api-gateway',  path: 'api-gateway',                 image: "${REGISTRY}/${OWNER}/api-gateway"],
            [name: 'auth-service', path: 'auth-service-microservice',   image: "${REGISTRY}/${OWNER}/auth-service-microservice"],
          ]

          def changedFiles = []
          if (env.GIT_PREVIOUS_SUCCESSFUL_COMMIT) {
            def out = bat(returnStdout: true, script: 'git diff --name-only %GIT_PREVIOUS_SUCCESSFUL_COMMIT% HEAD').trim()
            if (out) changedFiles = out.split(/\r?\n/).collect { it.replace('\\','/') }
          } else {
            echo 'Primer build: construir todos los servicios.'
            changedFiles = ['__build_all__']
          }

          def toBuild = catalog.findAll { svc ->
            changedFiles.contains('__build_all__') || changedFiles.any { it.startsWith("${svc.path}/") }
          }

          if (!toBuild) {
            echo 'No hay cambios en carpetas de servicios. Fin.'
            currentBuild.description = 'No service changes'
            return
          }

          env.SVCS_JSON = groovy.json.JsonOutput.toJson(toBuild)
          echo "Servicios a construir: " + toBuild.collect { it.name }.join(', ')
        }
      }
    }

    stage('Login GHCR') {
      when { expression { return env.SVCS_JSON?.trim() } }
      steps {
        withCredentials([usernamePassword(credentialsId: 'REGISTRY_CREDS', usernameVariable: 'REG_USER', passwordVariable: 'REG_PWD')]) {
          bat """
          docker logout ghcr.io 2>nul
          echo %REG_PWD% | docker login ghcr.io -u %REG_USER% --password-stdin
          """
        }
      }
    }

    stage('Build & Push + Deploy') {
      when { expression { return env.SVCS_JSON?.trim() } }
      steps {
        script {
          def svcs = new groovy.json.JsonSlurperClassic().parseText(env.SVCS_JSON)
          for (svc in svcs) {
            stage("Build & Push: ${svc.name}") {
              bat """
              docker build -t ${svc.image}:${env.BUILD_NUMBER} -t ${svc.image}:latest -f ${svc.path}\\Dockerfile ${svc.path}
              docker push ${svc.image}:${env.BUILD_NUMBER}
              docker push ${svc.image}:latest
              """
            }
            stage("Deploy: ${svc.name}") {
              build job: 'arquitectura-deploy', parameters: [
                string(name: 'SERVICE', value: svc.name),            // el nombre del servicio en tu compose (auth-service, api-gateway)
                string(name: 'TAG',     value: "${env.BUILD_NUMBER}")// desplegamos la versión exacta
              ]
            }
          }
        }
      }
    }
  }
}
