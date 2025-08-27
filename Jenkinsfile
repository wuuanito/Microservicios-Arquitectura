pipeline {
  agent { label 'windows-docker' }

  environment {
    REGISTRY = 'ghcr.io'
    OWNER    = 'wuuanito'
  }

  options { skipDefaultCheckout(true) }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Login GHCR') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'REGISTRY_CREDS', usernameVariable: 'REG_USER', passwordVariable: 'REG_PWD')]) {
          bat """
          docker logout %REGISTRY% 2>nul
          echo %REG_PWD% | docker login %REGISTRY% -u %REG_USER% --password-stdin
          """
        }
      }
    }

    stage('Build & Push TODOS') {
      steps {
        script {
          def services = [
            [name: 'api-gateway',  path: 'api-gateway',             image: "${env.REGISTRY}/${env.OWNER}/api-gateway"],
            [name: 'auth-service', path: 'auth-service-microservice', image: "${env.REGISTRY}/${env.OWNER}/auth-service-microservice"],
            // añade aquí más servicios cuando existan:
            // [name: 'user-service', path: 'user-service', image: "${env.REGISTRY}/${env.OWNER}/user-service"]
          ]

          services.each { s ->
            echo "Construyendo y publicando ${s.name}"
            bat """
            docker build -t ${s.image}:${env.BUILD_NUMBER} -t ${s.image}:latest -f ${s.path}\Dockerfile ${s.path}
            docker push ${s.image}:${env.BUILD_NUMBER}
            docker push ${s.image}:latest
            """
          }
        }
      }
    }

    stage('Disparar despliegue (TODO)') {
      steps {
        // lanza el job de despliegue completo sin esperar
        build job: 'arquitectura-deploy', wait: false
      }
    }
  }
}
