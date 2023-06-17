#!/bin/bash

CATAGORY=$1
NAME=$2
OPT_VERSION=$3
echo $CATAGORY $NAME $OPT_VERSION

if [ -z $CATAGORY ]
then
  echo "Lack parameter CATAGORY"
  exit 1
fi

if [ -z $NAME ]
then
  echo "Lack parameter NAME"
  exit 1
fi

IMAGEID="omniverse/$CATAGORY-$NAME"

if [ ! -z $OPT_VERSION ]
then
  if [[ $OPT_VERSION != "--version" ]]
  then
    echo "The third parameter wrong"
    exit 2
  fi

  VERSION=$(cat package.json \
  | grep version \
  | head -1 \
  | awk -F: '{ print $2 }' \
  | sed 's/[",]//g' \
  | tr -d '[[:space:]]')
  IMAGEID="$IMAGEID:$VERSION"
fi

echo "Building $IMAGEID ..."
docker build -t $IMAGEID .
# Push docker image to repository

# Generate docker-compose.yaml
cp ./docker/docker-compose.yaml.template ./docker/docker-compose.yaml
sed -i "s/CATAGORY/${CATAGORY}/g" ./docker/docker-compose.yaml
sed -i "s/NAME/${NAME}/g" ./docker/docker-compose.yaml
sed -i "s/VERSION/${VERSION}/g" ./docker/docker-compose.yaml

# Generate launch script
echo "#!/bin/bash

# mkdir -p /opt/omniverse/node/$CATAGORY/$NAME/$VERSION/config
cp docker/docker-compose.yaml /opt/omniverse/node/$CATAGORY/$NAME/$VERSION
cd /opt/omniverse/node/$CATAGORY/$NAME/$VERSION/
docker-compose -p $CATAGORY-$NAME -f docker-compose.yaml up -d
" > ./docker/launch-synchronizer.sh