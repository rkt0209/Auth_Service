
const UserService =require('../services/user-service');
const {response} = require('express');
const userService = new UserService();

const create = async (req,res)=>{
    try {
        const response = await userService.create({
            email:req.body.email,
            password:req.body.password,
            role: req.body.role || 'Passenger'
        });

         return res.status(200).json({
            data:response,
            message:"Successfully created a user",
            success:true,
            err:{}
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            data:{},
            message:error.message,
            success:false,
            err:error.explanation
        });
    }
}
const get = async (req,res)=>{
    try {
        const response = await userService.get(req.params.id);

         return res.status(200).json({
            data:response,
            message:"Successfully get a user",
            success:true,
            err:{}
        });
    } catch (error) {
        return res.status(error.statusCode|| 500).json({
            data:{},
            message:error.message,
            success:false,
            err:error.explanation
        });
    }
}
const signIn = async(req,res)=>{
    try {
        const response = await userService.signIn(req.body.email, req.body.password, req.body.role || 'Passenger');
        return res.status(200).json({
            data:response,
            message:"Successful Sign In and Token Generated",
            success:true,
            err:{}
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            data:{},
            message:error.message,
            success:false,
            err:error.explanation
        });
    }
}
const isAuthenticated =async(req,res)=>{
    try{
    const token = req.headers['x-access-token'];
   const response = await userService.isAuthenticated(token);
   return res.status(200).json({
            data:response,
            message:"User is successfully authenticated",
            success:true,
            err:{}
        });
    }catch(error){
        return res.status(500).json({
            data:{},
            message:"Something went wrong in authenticating",
            success:false,
            err:error
        });
    }
}

const isAdmin= async(req,res)=>{
    try{
   const response = await userService.isAdmin(req.body.userId);
   return res.status(200).json({
            data:response,
            message:"Succesfully fetched wheather a user id admin",
            success:true,
            err:{}
        });
    }catch(error){
        return res.status(500).json({
            data:{},
            message:"Something went wrong in finding is admin",
            success:false,
            err:error
        });
    }
}
module.exports ={
    create,
    signIn,
    isAuthenticated,
    isAdmin,
    get
}