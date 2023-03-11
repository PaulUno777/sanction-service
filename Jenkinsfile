pipeline {
  agent any
  stages {
    stage('Checkout code') {
      steps {
        git(url: 'https://github.com/PaulUno777/sanction-service.git', branch: 'master', credentialsId: 'SANCTION-DOTENV')
      }
    }

  }
}