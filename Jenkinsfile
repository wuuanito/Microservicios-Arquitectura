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

    stage('Build & Push TODOS (sin cache)') {
      steps {
        script {
          def services = [
            [name: 'api-gateway',  path: 'api-gateway',  image: "${env.REGISTRY}/${env.OWNER}/api-gateway"],
            [name: 'auth-service', path: 'auth-service', image: "${env.REGISTRY}/${env.OWNER}/auth-service-microservice"],
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

    stage('Disparar despliegue TOTAL') {
      steps { build job: 'arquitectura-deploy', wait: false }
    }
  }
}
