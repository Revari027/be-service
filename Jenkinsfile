
pipeline {
    agent any

    environment {
        IMAGE_NAME  = "revario/inventory-backend"
        GCP_PROJECT = "rio-lab-project"
        GKE_CLUSTER = "inventory-systems"
        GKE_ZONE    = "asia-southeast1-b"
        NAMESPACE   = "inventory-systems"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
                sh 'npx prisma generate'
            }
        }

        stage('Test') {
            steps {
                sh 'npm test'
            }
        }

        stage('Build Image') {
            steps {
                script {
                    env.IMAGE_TAG = sh(
                        script: 'git rev-parse --short HEAD',
                        returnStdout: true
                    ).trim()
                }

                sh 'docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .'
            }
        }

        stage('Push Docker Hub') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'dockerhub-credentials',
                        usernameVariable: 'DOCKER_USER',
                        passwordVariable: 'DOCKER_PASS'
                    )
                ]) {
                    sh '''
                        set +x
                        echo "$DOCKER_PASS" |
                            docker login -u "$DOCKER_USER" --password-stdin

                        docker push "$IMAGE_NAME:$IMAGE_TAG"

                        docker logout
                    '''
                }
            }
        }

        stage('Configure GKE') {
            steps {
                sh '''
                    gcloud container clusters get-credentials \
                        "$GKE_CLUSTER" \
                        --zone="$GKE_ZONE" \
                        --project="$GCP_PROJECT"

                    kubectl get nodes
                '''
            }
        }

        stage('Deploy Backend') {
            steps {
                sh '''
                    kubectl set image \
                        deployment/inventory-backend \
                        backend="$IMAGE_NAME:$IMAGE_TAG" \
                        -n "$NAMESPACE"

                    kubectl rollout status \
                        deployment/inventory-backend \
                        -n "$NAMESPACE" \
                        --timeout=180s
                '''
            }
        }
    }

    post {
        success {
            echo 'Backend pipeline completed successfully.'
        }

        failure {
            echo 'Backend pipeline failed.'
        }
    }
}
