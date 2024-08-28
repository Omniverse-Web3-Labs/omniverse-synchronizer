npm i
npm run build
docker build -t omni/omniverse-synchronizer .
docker tag omni/omniverse-synchronizer 171678255258.dkr.ecr.ap-southeast-1.amazonaws.com/omni/omniverse-synchronizer
docker push 171678255258.dkr.ecr.ap-southeast-1.amazonaws.com/omni/omniverse-synchronizer
