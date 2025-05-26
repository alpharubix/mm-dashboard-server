import jsonwebtoken from 'jsonwebtoken'
import { ENV } from '../conf/index.js';
export async function validateUser(req,res,next) {
    try{
    const token = req.header('Authorization');
    if(!token){
        res.status(401).json({'error':"No token is provided"})
    }
    //if token is provided verify it with the jwt token
    const decoded = jsonwebtoken.verify(token,ENV.JWT_SECRET)
    req.user = decoded
    next()
    }
    catch(err){
        res.status(500).json({'message':"unable to process the request ",err})
    } 
}