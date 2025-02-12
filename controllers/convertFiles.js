const db = require("../routes/db.config")

const convertFIles = async(req,res) =>{

    try{
        const {manuscriptId} = req.query.a
        db.query("SELECT * manuscript_file, tables, figures, graphic_abstract, supplementary_material FROM submissions WHERE revision_id = ?", [manuscriptId], async (err, data) =>{
            if(err){
                console.log(err)
                return res.json({error:err})
            }
            if(data[0]){
                const manuscriptFile = data[0].manuscript_file 
                const tables = data[0].tables 
                const graphicAbstract = data[0].graphicAbstract 
                const supplementaryMaterial = data[0].supplementary_material
                
                
            }
        })
    }catch(error){
        return res.json({error:error.message})
    }


}


module.exports = convertFIles