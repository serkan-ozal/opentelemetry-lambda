LAYER_ARN=arn:aws:lambda:us-east-1:310788757301:layer:curl:15
URL=$(aws lambda get-layer-version-by-arn --arn $LAYER_ARN --query Content.Location --output text)
curl $URL -o layer.zip
